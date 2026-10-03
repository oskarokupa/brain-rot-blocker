/**
 * The round engine. Pure functions over a round's state, same discipline as
 * core/stateMachine.ts and for the same reason: scoring and the discard
 * mechanic are exactly the logic a bug here would show up as either a false
 * pass (an escape route) or a false fail (an unfair lock), so it has to be
 * testable without a browser.
 *
 * A "round" is deliberately the same shape whether it is the main challenge or
 * a remediation round. Remediation is not a special case here; it is just a
 * round built from fewer, easier questions, which keeps this module from
 * needing to know about the state machine's remediation rules at all.
 */

import { passMarkForCount } from '../config.js';
import type { AnswerResponse, Question } from './schema.js';
import { gradeAnswer } from './grade.js';

export interface AnsweredQuestion {
  question: Question;
  response: AnswerResponse;
  correct: boolean;
}

export interface RoundState {
  questions: Question[];
  /** Reserve pulled from on a discard. Shrinks as it is used. */
  spares: Question[];
  answers: AnsweredQuestion[];
  /** How many of the discard allowance have been spent this round. */
  discardsUsed: number;
  maxDiscards: number;
}

export function startRound(questions: Question[], spares: Question[], maxDiscards: number): RoundState {
  return { questions, spares, answers: [], discardsUsed: 0, maxDiscards };
}

export function currentQuestion(round: RoundState): Question | null {
  return round.questions[round.answers.length] ?? null;
}

export function isRoundComplete(round: RoundState): boolean {
  return round.answers.length >= round.questions.length;
}

export interface SubmitResult {
  round: RoundState;
  correct: boolean;
  /**
   * Set when a typed answer needs a second opinion this module cannot give.
   * Nothing is recorded yet: the question still has not been answered, so the
   * caller is free to send it to the LLM or swap in the fallback multiple
   * choice form without that swap costing her a discard or a wrong answer.
   */
  uncertain: boolean;
}

/** Records an answer to the current question. Call only when one is pending. */
export function submitAnswer(round: RoundState, response: AnswerResponse): SubmitResult {
  const question = currentQuestion(round);
  if (!question) return { round, correct: false, uncertain: false };

  const result = gradeAnswer(question, response);
  if (result.uncertain) return { round, correct: false, uncertain: true };

  const answers = [...round.answers, { question, response, correct: result.correct }];
  return { round: { ...round, answers }, correct: result.correct, uncertain: false };
}

/**
 * Records a verdict decided outside this module's own grading - the LLM's
 * binary judgment on a typed answer local matching could not resolve.
 * Appends directly rather than re-grading, since gradeAnswer would only
 * reach 'uncertain' again for the same input.
 */
export function recordExternalVerdict(
  round: RoundState,
  question: Question,
  response: AnswerResponse,
  correct: boolean,
): RoundState {
  return { ...round, answers: [...round.answers, { question, response, correct }] };
}

/**
 * Swaps the current question for a replacement without touching the discard
 * allowance or the spares queue. Used when a typed answer comes back
 * uncertain and there is no LLM available to break the tie: the fallback
 * multiple-choice twin takes its place and she answers that instead.
 */
export function replaceCurrentQuestion(round: RoundState, replacement: Question): RoundState {
  const index = round.answers.length;
  const questions = [...round.questions];
  questions[index] = replacement;
  return { ...round, questions };
}

export interface DiscardResult {
  round: RoundState;
  ok: boolean;
}

/**
 * Throws away the current question for a fresh one from the spares. Never
 * counts as wrong and never consumes a question slot: the round still needs
 * exactly as many answers as it started with.
 */
export function discardCurrentQuestion(round: RoundState): DiscardResult {
  if (round.discardsUsed >= round.maxDiscards) return { round, ok: false };
  const spare = round.spares[0];
  if (!spare) return { round, ok: false };

  const index = round.answers.length;
  const questions = [...round.questions];
  questions[index] = spare;

  return {
    round: {
      ...round,
      questions,
      spares: round.spares.slice(1),
      discardsUsed: round.discardsUsed + 1,
    },
    ok: true,
  };
}

export interface RoundScore {
  correctCount: number;
  total: number;
  passed: boolean;
}

/** Scores a complete round against the pass mark for its length. */
export function scoreRound(round: RoundState): RoundScore {
  const correctCount = round.answers.filter((a) => a.correct).length;
  const total = round.questions.length;
  return { correctCount, total, passed: correctCount >= passMarkForCount(total) };
}
