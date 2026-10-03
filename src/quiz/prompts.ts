/**
 * Prompt construction for quiz generation.
 *
 * The JSON Schema on the request already guarantees shape: the right number
 * of questions, the right option counts, the right field names. Everything
 * in here is aimed at content quality instead, which nothing downstream can
 * enforce as cleanly - the SOP's question-quality bar (understanding over
 * trivia, plausible distractors, no repeats) is a prompting problem, not a
 * schema problem. validate.ts still catches what this fails to prevent
 * (duplicate options, "all of the above", a correct answer not actually in
 * the options), and a validation failure triggers exactly one regenerate
 * attempt with the specific problems appended, handled in generate.ts.
 */

const QUALITY_RULES = `You are writing a short comprehension check for a child around 9 to 14 years old, about a video she just watched on YouTube Kids. The goal is to find out whether she was actually paying attention, not to catch her out on trivia.

Prioritise questions about: the main idea, cause and effect, the order events happened in, why a character did something, a fact that actually mattered to the video, and simple inference. Avoid incidental details that do not matter to the content, such as background colours or objects nobody would remember.

For every multiple-choice question (single-select, multi-select, and the typed question's fallback): every option must be believable in the context of the video. Distractors should use people, places, events or concepts that actually appear in the video, not invented nonsense. Keep every option a similar length and level of detail, so nothing gives itself away by looking out of place. Never use "all of the above" or "none of the above". Exactly one option is correct for a single-select question; the wording must not hint at which one. A question should not be answerable from general knowledge alone - it should require having watched this specific video.

For the multi-select question: write five options where two or three are correct. The others should be plausible enough that guessing is not an easy way to pass.

For the typed question: expectedConcept should state the one idea a correct answer needs to contain, in a sentence a child would actually say, not a rigid phrase. Keywords should be the handful of words a correct answer would likely include. exampleAnswers needs at least three different ways of phrasing a correct answer, varying the wording so a simple grading pass can recognise more than one exact string. fallbackOptions is a multiple-choice version of the exact same question, for use if the typed answer cannot be graded automatically - it follows the same distractor-quality rules as every other multiple-choice question.

For the remediation questions: write six simple recognition-level questions about the video's content, independent of the main five. Two should be difficulty 1 (very easy, clearly stated facts) and the rest difficulty 2 (straightforward but requires having watched). These exist as a safety net if she needs a second pass, so lean toward clear and answerable rather than tricky.

At least two of the eleven generated questions (the three single-select plus the typed question) should require actual understanding rather than simple fact recall.`;

function repeatAvoidanceSection(priorPrompts: string[]): string {
  if (priorPrompts.length === 0) return '';
  const list = priorPrompts.map((p) => `- ${p}`).join('\n');
  return `\n\nThis video has been quizzed before. Do not repeat or closely paraphrase any of these previous questions:\n${list}`;
}

export interface GenerationPromptInput {
  /** The video's own transcript text, when one was captured. */
  transcriptText?: string;
  /** Used only when no transcript is available. */
  metadata?: { title: string | null; channel: string | null; description: string | null };
  /** Recent prompts asked about this same video, so a rewatch gets new questions. */
  priorPrompts: string[];
}

export interface Prompt {
  system: string;
  user: string;
}

export function buildGenerationPrompt(input: GenerationPromptInput): Prompt {
  const system = QUALITY_RULES + repeatAvoidanceSection(input.priorPrompts);

  if (input.transcriptText) {
    return {
      system,
      user: `Here is the transcript of the video:\n\n${input.transcriptText}\n\nWrite the questions described in your instructions, based on this transcript.`,
    };
  }

  const meta = input.metadata;
  const parts = [
    meta?.title ? `Title: ${meta.title}` : null,
    meta?.channel ? `Channel: ${meta.channel}` : null,
    meta?.description ? `Description: ${meta.description}` : null,
  ].filter((p): p is string => p !== null);

  return {
    system,
    user: `No transcript was available for this video, only its metadata below. Write questions about the general topic and likely content the title and description describe, making clear through phrasing that these are about the video's subject rather than specific moments you cannot know happened.\n\n${parts.join('\n')}`,
  };
}

const GRADE_SYSTEM = `You are grading one answer in a short comprehension quiz for a child. You will be given the concept a correct answer needs to express and the child's actual typed answer. Decide only whether the child's answer expresses the same concept, allowing for different wording, spelling mistakes, and informal phrasing a child would use. Do not require exact wording. A negated or opposite statement is not equivalent even if it shares many of the same words.`;

export function buildGradePrompt(expectedConcept: string, answer: string): Prompt {
  return {
    system: GRADE_SYSTEM,
    user: `Expected concept: ${expectedConcept}\n\nChild's answer: ${answer}\n\nDoes the child's answer express the same concept?`,
  };
}
