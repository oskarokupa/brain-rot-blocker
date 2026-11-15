/**
 * Persists the active quiz and the round in progress, and is the one place
 * that turns a finished round into a lock-state transition.
 *
 * Its own serialized write queue, separate from core/store.ts, for the same
 * reason diagnostics has one: a race here must not corrupt the lock state, and
 * a race on the lock state must not corrupt this. Finishing a round still
 * calls into core/store.dispatch, which has its own queue, so the two never
 * interleave with each other's reads and writes.
 */

import { CONFIG, passMarkForCount } from '../config.js';
import { dispatch } from '../core/store.js';
import type { GenerationContent } from './llm/generate.js';
import { generateQuiz } from './llm/generate.js';
import { gradeTypedWithLlm } from './llm/gradeTyped.js';
import {
  currentQuestion,
  discardCurrentQuestion as discardFromRound,
  isRoundComplete,
  recordExternalVerdict,
  replaceCurrentQuestion,
  scoreRound,
  startRound,
  submitAnswer as submitToRound,
  type RoundState,
} from './engine.js';
import {
  promptsForVideo,
  recordUsed,
  recordVideoQuestions,
  type RecentIds,
  type VideoHistory,
} from './history.js';
import type { RewardSummary } from '../rewards/rewards.js';
import { recordRound } from '../rewards/rewardsStore.js';
import type { AnswerResponse, Question, Quiz, QuizSource } from './schema.js';

const QUIZ_KEY = 'quiz.v1';
const RECENT_IDS_KEY = 'quizRecentIds.v1';
const VIDEO_HISTORY_KEY = 'quizVideoHistory.v1';

interface QuizDocument {
  quiz: Quiz;
  /** 0 is the main challenge. 1+ is a remediation round. */
  round: number;
  roundState: RoundState;
}

let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

async function readDoc(): Promise<QuizDocument | null> {
  const stored = await chrome.storage.local.get(QUIZ_KEY);
  return (stored[QUIZ_KEY] as QuizDocument) ?? null;
}

async function writeDoc(doc: QuizDocument | null): Promise<void> {
  if (doc) await chrome.storage.local.set({ [QUIZ_KEY]: doc });
  else await chrome.storage.local.remove(QUIZ_KEY);
}

async function readRecentIds(): Promise<RecentIds> {
  const stored = await chrome.storage.local.get(RECENT_IDS_KEY);
  return (stored[RECENT_IDS_KEY] as RecentIds) ?? [];
}

async function addRecentIds(ids: string[]): Promise<void> {
  let recent = await readRecentIds();
  for (const id of ids) recent = recordUsed(recent, id, CONFIG.fallback.noRepeatWindow);
  await chrome.storage.local.set({ [RECENT_IDS_KEY]: recent });
}

async function readVideoHistory(): Promise<VideoHistory> {
  const stored = await chrome.storage.local.get(VIDEO_HISTORY_KEY);
  return (stored[VIDEO_HISTORY_KEY] as VideoHistory) ?? [];
}

async function recordVideoHistory(videoId: string | null, prompts: string[]): Promise<void> {
  if (!videoId) return;
  const history = await readVideoHistory();
  await chrome.storage.local.set({
    [VIDEO_HISTORY_KEY]: recordVideoQuestions(history, videoId, prompts),
  });
}

/* ------------------------------------------------------------------ *
 * Starting a challenge
 * ------------------------------------------------------------------ */

/** Builds a challenge for the video and stores it as the active one. */
async function buildAndStore(
  videoId: string | null,
  durationSeconds: number | null,
  content: GenerationContent,
): Promise<void> {
  const recent = await readRecentIds();
  const priorPromptsForVideo = videoId ? promptsForVideo(await readVideoHistory(), videoId) : [];

  // generateQuiz is the one place the transcript -> metadata -> bank degrade
  // chain lives. Whatever comes back is already a complete, validated Quiz
  // regardless of which tier produced it.
  const quiz = await generateQuiz({
    videoId,
    durationSeconds,
    content,
    recentQuestionIds: recent,
    priorPromptsForVideo,
  });
  const roundState = startRound(quiz.questions, quiz.spares, CONFIG.quiz.maxDiscardsPerQuiz);

  await writeDoc({ quiz, round: 0, roundState });
  await addRecentIds(quiz.questions.map((q) => q.id));
  await recordVideoHistory(videoId, quiz.questions.map((q) => q.prompt));
}

export function startMainQuiz(
  videoId: string | null,
  durationSeconds: number | null,
  content: GenerationContent,
): Promise<void> {
  return serialize(async () => {
    // Whatever was stored belongs to an earlier obligation. A challenge that
    // ended in a parent skip or a fault leaves its document behind, and it
    // must not be what she is shown if this generation is cut short.
    await writeDoc(null);
    await buildAndStore(videoId, durationSeconds, content);
  });
}

/**
 * Guarantees the stored challenge is about the video that is actually owed,
 * called right before the challenge is shown. Normally a no-op, because
 * generation started at the threshold has already stored it. It matters when
 * that generation never finished (the worker restarted part way through) or a
 * document from an earlier video is still in storage: without this check the
 * screen showed whatever was stored, about whichever video that happened to be.
 * A matching document is left alone, so a challenge she is part way through
 * keeps its progress.
 */
export function ensureQuizFor(
  videoId: string,
  durationSeconds: number | null,
  content: GenerationContent,
): Promise<void> {
  return serialize(async () => {
    const doc = await readDoc();
    if (doc && doc.quiz.videoId === videoId) return;
    if (doc) console.warn('[brb] stored quiz was for', doc.quiz.videoId, 'but', videoId, 'is owed. Rebuilding.');
    await writeDoc(null);
    await buildAndStore(videoId, durationSeconds, content);
  });
}

export function startRemediationRound(round: number): Promise<void> {
  return serialize(async () => {
    const doc = await readDoc();
    if (!doc) return;

    const perRound = CONFIG.remediation.questionsPerRound;
    const start = (round - 1) * perRound;
    const picked = doc.quiz.remediationPool.slice(start, start + perRound);

    // The pool is sized for exactly maxRounds * questionsPerRound. Running out
    // means a round was reached the config does not expect; the state machine
    // caps rounds before this happens, so treat it as a sign to stop rather
    // than silently proceeding with fewer questions than she expects.
    if (picked.length === 0) return;

    // No spare pool during remediation: the pool is sized exactly for the
    // rounds it supports, with nothing left over for a discard.
    const roundState = startRound(picked, [], 0);
    await writeDoc({ ...doc, round, roundState });
    await addRecentIds(picked.map((q) => q.id));
  });
}

/* ------------------------------------------------------------------ *
 * Reading, for the challenge surface to render
 * ------------------------------------------------------------------ */

export interface ActiveQuestionView {
  question: Question;
  index: number;
  total: number;
  discardsLeft: number;
  maxDiscards: number;
  round: number;
  /** Correct answers this round needs. */
  passMark: number;
  /** Where the questions came from, so the screen can say when they are general ones. */
  source: QuizSource;
  /** The language the questions are written in. The screen's own text follows it. */
  language: UiLanguage;
}

export type UiLanguage = 'en' | 'es';

/** Bank questions are Spanish. Everything the model writes is English. */
function languageOf(quiz: Quiz): UiLanguage {
  return quiz.source === 'fallback' ? CONFIG.fallback.language : 'en';
}

export function getActiveQuestion(): Promise<ActiveQuestionView | null> {
  return serialize(async () => {
    const doc = await readDoc();
    if (!doc) return null;
    const question = currentQuestion(doc.roundState);
    if (!question) return null;
    return {
      question,
      index: doc.roundState.answers.length,
      total: doc.roundState.questions.length,
      discardsLeft: doc.roundState.maxDiscards - doc.roundState.discardsUsed,
      maxDiscards: doc.roundState.maxDiscards,
      round: doc.round,
      passMark: passMarkForCount(doc.roundState.questions.length),
      source: doc.quiz.source,
      language: languageOf(doc.quiz),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Answering
 * ------------------------------------------------------------------ */

export type SubmitOutcome =
  | { kind: 'answered'; correct: boolean; explanation: string; xp: number }
  | {
      kind: 'roundComplete';
      correct: boolean;
      explanation: string;
      xp: number;
      correctCount: number;
      total: number;
      /** Whether this round's score met its pass mark. */
      passed: boolean;
      /** Null only if the rewards store failed, which must never fail the round. */
      rewards: RewardSummary | null;
      /**
       * Whether the obligation actually ended, which is not the same question
       * as whether the round's score passed. The final remediation round
       * unlocks regardless of score — a child who has missed three rounds
       * needs a parent, not a fourth quiz — and that always reads as cleared,
       * never as a failure, in anything shown to her.
       */
      cleared: boolean;
    }
  /** A typed answer with no confident local verdict. Swapped, not graded. */
  | { kind: 'needsRetry'; question: Question }
  | { kind: 'noActiveQuestion' };

/** A round that has just been completed and still has to be reported. */
interface FinishedRound {
  round: number;
  correctCount: number;
  total: number;
  passed: boolean;
}

interface Settled {
  outcome: SubmitOutcome;
  /** Set when this answer completed the round. */
  finished: FinishedRound | null;
}

/**
 * Whether the obligation ends with this round. It survives only if another
 * round follows: a failed main quiz (remediation round 1 comes next) or a
 * failed remediation round short of the cap. Everything else ends it,
 * including failing the final remediation round, which the state machine
 * clears unconditionally.
 */
function endsObligation(round: number, passed: boolean): boolean {
  return passed || round >= CONFIG.remediation.maxRounds;
}

/** Persists a round and describes what the answer led to. */
async function settleRound(
  doc: QuizDocument,
  question: Question,
  roundState: RoundState,
  correct: boolean,
): Promise<Settled> {
  const xp = correct ? CONFIG.rewards.xpPerCorrectAnswer : 0;

  if (!isRoundComplete(roundState)) {
    await writeDoc({ ...doc, roundState });
    return { outcome: { kind: 'answered', correct, explanation: question.explanation, xp }, finished: null };
  }

  const score = scoreRound(roundState);
  const cleared = endsObligation(doc.round, score.passed);
  // A finished challenge leaves nothing behind. One with a round still to
  // come keeps its document, because that round is dealt from its pool.
  await writeDoc(cleared ? null : { ...doc, roundState });

  return {
    outcome: {
      kind: 'roundComplete',
      correct,
      explanation: question.explanation,
      xp,
      correctCount: score.correctCount,
      total: score.total,
      passed: score.passed,
      rewards: null,
      cleared,
    },
    finished: { round: doc.round, correctCount: score.correctCount, total: score.total, passed: score.passed },
  };
}

function settleAnswer(response: AnswerResponse): Promise<Settled> {
  return serialize(async () => {
    const none: Settled = { outcome: { kind: 'noActiveQuestion' }, finished: null };

    const doc = await readDoc();
    if (!doc) return none;

    const question = currentQuestion(doc.roundState);
    if (!question) return none;

    const result = submitToRound(doc.roundState, response);

    if (result.uncertain) {
      if (question.type !== 'typed' || response.type !== 'typed') return none;

      // Local matching could not reach a confident verdict. The LLM is the
      // next tier up; a hard timeout on that call is what keeps this from
      // ever turning into an indefinite wait on her "Checking..." screen.
      const llmVerdict = await gradeTypedWithLlm(question.expectedConcept, response.text);
      if (llmVerdict !== null) {
        const roundState = recordExternalVerdict(doc.roundState, question, response, llmVerdict);
        return settleRound(doc, question, roundState, llmVerdict);
      }

      // No LLM verdict available at all (no key, network failure, timeout):
      // swap to the pre-built multiple-choice twin rather than leave her
      // waiting on a verdict that will never arrive. Does not count as a
      // discard and does not cost her anything.
      const replacement = question.fallbackMultipleChoice;
      const roundState = replaceCurrentQuestion(doc.roundState, replacement);
      await writeDoc({ ...doc, roundState });
      return { outcome: { kind: 'needsRetry', question: replacement }, finished: null };
    }

    return settleRound(doc, question, result.round, result.correct);
  });
}

/**
 * Grades an answer and, when it completes a round, reports the round to the
 * lock state machine.
 *
 * The report happens after this module's queue has been released, never
 * inside it. A missed round makes the state machine ask for the next
 * remediation round, and that request comes straight back into this queue. It
 * used to be made while the queue was still held by the answer that caused
 * it, so the two waited on each other forever and she sat on "Checking..."
 * with no way forward.
 */
export async function submitAnswer(response: AnswerResponse): Promise<SubmitOutcome> {
  const { outcome, finished } = await settleAnswer(response);
  if (!finished || outcome.kind !== 'roundComplete') return outcome;

  if (finished.round === 0) {
    await dispatch({ type: finished.passed ? 'quizPassed' : 'quizFailed' });
  } else {
    await dispatch({ type: finished.passed ? 'remediationPassed' : 'remediationFailed' });
  }

  // After the lock transition, never before it: rewards are a record of the
  // round, and a storage fault here must not be able to hold up an unlock.
  const rewards = await recordRound(finished).catch((err) => {
    console.error('[brb] rewards not recorded', err);
    return null;
  });

  return { ...outcome, rewards };
}

export function discardCurrentQuestion(): Promise<{ ok: boolean; question: Question | null }> {
  return serialize(async () => {
    const doc = await readDoc();
    if (!doc) return { ok: false, question: null };

    const result = discardFromRound(doc.roundState);
    if (!result.ok) return { ok: false, question: currentQuestion(doc.roundState) };

    await writeDoc({ ...doc, roundState: result.round });
    return { ok: true, question: currentQuestion(result.round) };
  });
}

export function clearActiveQuiz(): Promise<void> {
  return serialize(() => writeDoc(null));
}
