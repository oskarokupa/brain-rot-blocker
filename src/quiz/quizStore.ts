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

import { CONFIG } from '../config.js';
import { dispatch } from '../core/store.js';
import { buildFallbackQuiz } from './build.js';
import {
  currentQuestion,
  discardCurrentQuestion as discardFromRound,
  isRoundComplete,
  replaceCurrentQuestion,
  scoreRound,
  startRound,
  submitAnswer as submitToRound,
  type RoundState,
} from './engine.js';
import { recordUsed, recordVideoQuestions, type RecentIds, type VideoHistory } from './history.js';
import type { AnswerResponse, Question, Quiz } from './schema.js';

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

async function recordVideoHistory(videoId: string | null, prompts: string[]): Promise<void> {
  if (!videoId) return;
  const stored = await chrome.storage.local.get(VIDEO_HISTORY_KEY);
  const history = (stored[VIDEO_HISTORY_KEY] as VideoHistory) ?? [];
  await chrome.storage.local.set({
    [VIDEO_HISTORY_KEY]: recordVideoQuestions(history, videoId, prompts),
  });
}

/* ------------------------------------------------------------------ *
 * Starting a challenge
 * ------------------------------------------------------------------ */

export function startMainQuiz(videoId: string | null, durationSeconds: number | null): Promise<void> {
  return serialize(async () => {
    const recent = await readRecentIds();
    const quiz = buildFallbackQuiz({ videoId, durationSeconds, recentQuestionIds: recent });
    const roundState = startRound(quiz.questions, quiz.spares, CONFIG.quiz.maxDiscardsPerQuiz);

    await writeDoc({ quiz, round: 0, roundState });
    await addRecentIds(quiz.questions.map((q) => q.id));
    await recordVideoHistory(videoId, quiz.questions.map((q) => q.prompt));
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
  round: number;
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
      round: doc.round,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Answering
 * ------------------------------------------------------------------ */

export type SubmitOutcome =
  | { kind: 'answered'; correct: boolean; explanation: string }
  | {
      kind: 'roundComplete';
      correct: boolean;
      explanation: string;
      correctCount: number;
      total: number;
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

export function submitAnswer(response: AnswerResponse): Promise<SubmitOutcome> {
  return serialize(async () => {
    const doc = await readDoc();
    if (!doc) return { kind: 'noActiveQuestion' };

    const question = currentQuestion(doc.roundState);
    if (!question) return { kind: 'noActiveQuestion' };

    const result = submitToRound(doc.roundState, response);

    if (result.uncertain) {
      // No LLM in this phase, which is exactly the "LLM unavailable" branch
      // the design calls for: swap to the pre-built multiple-choice twin
      // rather than leave her waiting on a verdict that will never arrive.
      if (question.type !== 'typed') return { kind: 'noActiveQuestion' };
      const replacement = question.fallbackMultipleChoice;
      const roundState = replaceCurrentQuestion(doc.roundState, replacement);
      await writeDoc({ ...doc, roundState });
      return { kind: 'needsRetry', question: replacement };
    }

    await writeDoc({ ...doc, roundState: result.round });

    if (!isRoundComplete(result.round)) {
      return { kind: 'answered', correct: result.correct, explanation: question.explanation };
    }

    const score = scoreRound(result.round);
    const cleared = await finishRound(doc.round, score.passed);

    return {
      kind: 'roundComplete',
      correct: result.correct,
      explanation: question.explanation,
      correctCount: score.correctCount,
      total: score.total,
      cleared,
    };
  });
}

/** Dispatches the round's outcome and returns whether the obligation ended. */
async function finishRound(round: number, passed: boolean): Promise<boolean> {
  if (round === 0) {
    await dispatch({ type: passed ? 'quizPassed' : 'quizFailed' });
  } else {
    await dispatch({ type: passed ? 'remediationPassed' : 'remediationFailed' });
  }

  // The obligation survives only if the state machine is about to ask for
  // another round: a failed main quiz (round moves to remediation round 1) or
  // a failed remediation round short of the cap. Everything else — a pass at
  // any point, or failing the final remediation round, which the state
  // machine clears unconditionally — ends it, which is the "cleared" this
  // function reports back regardless of the raw score.
  const anotherRoundFollows = !passed && round < CONFIG.remediation.maxRounds;
  if (!anotherRoundFollows) await writeDoc(null);
  return !anotherRoundFollows;
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
