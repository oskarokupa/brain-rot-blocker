/**
 * Turns a video (transcript, or failing that metadata) into a Quiz, with the
 * local fallback bank as the floor nothing can fall through.
 *
 * This is the one place the degrade chain from the SOP actually lives: no API
 * key, no transcript and no usable metadata, a timeout, a rate limit, a
 * malformed response, or a response that fails validate.ts twice all end up
 * in the same place. Every failure here is caught and silently routed to the
 * next tier down - the child never sees an error, only a quiz, and a network
 * problem never leaves her without one.
 */

import { CONFIG, questionCountForDuration } from '../../config.js';
import { buildFallbackQuiz } from '../build.js';
import type { RecentIds } from '../history.js';
import type {
  MultiSelectQuestion,
  Question,
  Quiz,
  SingleSelectQuestion,
  TypedQuestion,
} from '../schema.js';
import { validateQuizQuestions } from '../validate.js';
import { typeMixFor } from '../../fallback/select.js';
import { getApiKey } from './apiKeyStore.js';
import { AnthropicError, callStructured } from './anthropic.js';
import { buildGenerationPrompt } from '../prompts.js';
import { GENERATION_JSON_SCHEMA, type GeneratedBundle, type GeneratedSingleSelect } from './schema.js';

export interface GenerationContent {
  transcriptText: string | null;
  metadata: { title: string | null; channel: string | null; description: string | null } | null;
}

export interface GenerateQuizOptions {
  videoId: string | null;
  durationSeconds: number | null;
  content: GenerationContent;
  recentQuestionIds: RecentIds;
  priorPromptsForVideo: string[];
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ *
 * Converting the flat generated shape into Question[]
 * ------------------------------------------------------------------ */

function toSingleSelect(id: string, item: GeneratedSingleSelect): SingleSelectQuestion {
  return {
    id,
    type: 'singleSelect',
    prompt: item.prompt,
    options: item.options,
    correctIndex: item.correctIndex,
    explanation: item.explanation,
  };
}

function toMultiSelect(id: string, bundle: GeneratedBundle): MultiSelectQuestion {
  return {
    id,
    type: 'multiSelect',
    prompt: bundle.multiSelect.prompt,
    options: bundle.multiSelect.options,
    correctIndices: bundle.multiSelect.correctIndices,
    explanation: bundle.multiSelect.explanation,
  };
}

function toTyped(id: string, bundle: GeneratedBundle): TypedQuestion {
  return {
    id,
    type: 'typed',
    prompt: bundle.typed.prompt,
    expectedConcept: bundle.typed.expectedConcept,
    keywords: bundle.typed.keywords,
    exampleAnswers: bundle.typed.exampleAnswers,
    explanation: bundle.typed.explanation,
    fallbackMultipleChoice: {
      id: `${id}-mc`,
      type: 'singleSelect',
      prompt: bundle.typed.prompt,
      options: bundle.typed.fallbackOptions,
      correctIndex: bundle.typed.fallbackCorrectIndex,
      explanation: bundle.typed.explanation,
    },
  };
}

/**
 * The full 3/1/1 set the bundle always carries, trimmed to the question count
 * the video's length actually calls for. Reuses the same length policy the
 * fallback bank selection uses, so a 40-second video gets one question
 * whether it came from the bank or the model.
 */
function assembleMainQuestions(videoId: string, bundle: GeneratedBundle, questionCount: number): Question[] {
  const singleSelects = bundle.singleSelect.map((item, i) => toSingleSelect(`${videoId}-ss-${i}`, item));
  const multi = toMultiSelect(`${videoId}-ms`, bundle);
  const typed = toTyped(`${videoId}-ty`, bundle);

  const byType: Record<string, Question[]> = { singleSelect: singleSelects, typed: [typed], multiSelect: [multi] };
  const questions: Question[] = [];
  for (const [type, count] of typeMixFor(questionCount)) {
    questions.push(...(byType[type] ?? []).slice(0, count));
  }
  return questions;
}

function assembleSpares(videoId: string, bundle: GeneratedBundle): Question[] {
  return bundle.spares.map((item, i) => toSingleSelect(`${videoId}-spare-${i}`, item));
}

function assembleRemediationPool(videoId: string, bundle: GeneratedBundle): Question[] {
  return bundle.remediation.map((item, i) => ({
    ...toSingleSelect(`${videoId}-rem-${i}`, item),
    meta: { difficulty: item.difficulty },
  }));
}

/* ------------------------------------------------------------------ *
 * One generation attempt
 * ------------------------------------------------------------------ */

async function attemptGeneration(
  apiKey: string,
  content: GenerationContent,
  priorPrompts: string[],
  correction: string | null,
): Promise<GeneratedBundle> {
  const prompt = buildGenerationPrompt({
    transcriptText: content.transcriptText ?? undefined,
    metadata: content.metadata ?? undefined,
    priorPrompts,
  });
  const system = correction
    ? `${prompt.system}\n\nYour previous attempt had these problems, fix them this time:\n${correction}`
    : prompt.system;

  return callStructured<GeneratedBundle>({
    apiKey,
    system,
    user: prompt.user,
    jsonSchema: GENERATION_JSON_SCHEMA,
    maxTokens: CONFIG.llm.maxTokens,
    timeoutMs: CONFIG.llm.generateTimeoutMs,
  });
}

/**
 * Generates via the LLM and validates the result, retrying once with the
 * specific problems named if the first attempt fails validation. Returns null
 * for every kind of failure - the caller's job is deciding what to show
 * instead, not this function's.
 */
async function generateValidated(
  apiKey: string,
  videoId: string,
  content: GenerationContent,
  priorPrompts: string[],
  questionCount: number,
): Promise<{ questions: Question[]; spares: Question[]; remediationPool: Question[] } | null> {
  let correction: string | null = null;

  for (let attempt = 0; attempt <= CONFIG.llm.generateRetries; attempt++) {
    let bundle: GeneratedBundle;
    try {
      bundle = await attemptGeneration(apiKey, content, priorPrompts, correction);
    } catch (err) {
      // Network, auth, rate limit, timeout, malformed JSON: none of these are
      // worth retrying with a corrective prompt, since the problem was never
      // the content. Only a validation failure gets the retry.
      console.warn(
        '[brb] generation request failed:',
        err instanceof AnthropicError ? `${err.kind} (${err.message})` : err,
      );
      return null;
    }

    const questions = assembleMainQuestions(videoId, bundle, questionCount);
    const spares = assembleSpares(videoId, bundle);
    const remediationPool = assembleRemediationPool(videoId, bundle);

    const mainResult = validateQuizQuestions(questions, questionCount);
    const spareResult = validateQuizQuestions(spares, spares.length);
    const remediationResult = validateQuizQuestions(remediationPool, remediationPool.length);
    const problems = [...mainResult.problems, ...spareResult.problems, ...remediationResult.problems];

    if (problems.length === 0) return { questions, spares, remediationPool };

    console.warn('[brb] generated quiz failed validation:', problems);
    correction = problems.join('; ');
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * The public entry point
 * ------------------------------------------------------------------ */

export async function generateQuiz(options: GenerateQuizOptions): Promise<Quiz> {
  const questionCount = questionCountForDuration(options.durationSeconds ?? Infinity);
  const videoId = options.videoId ?? 'fallback';

  const apiKey = await getApiKey();
  const hasContent = Boolean(options.content.transcriptText || options.content.metadata?.title);

  if (apiKey && hasContent) {
    const result = await generateValidated(
      apiKey,
      videoId,
      options.content,
      options.priorPromptsForVideo,
      questionCount,
    );
    if (result) {
      return {
        id: makeId('quiz'),
        videoId: options.videoId,
        source: options.content.transcriptText ? 'transcript' : 'metadata',
        questions: result.questions,
        spares: result.spares,
        remediationPool: result.remediationPool,
        createdAt: Date.now(),
      };
    }
  }

  // No key, no content, or every attempt above failed. The bank works fully
  // offline and needs nothing this branch depends on.
  return buildFallbackQuiz({
    videoId: options.videoId,
    durationSeconds: options.durationSeconds,
    recentQuestionIds: options.recentQuestionIds,
  });
}
