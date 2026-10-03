/**
 * Grading. Pure functions, no network, no chrome.* calls.
 *
 * Single-select and multi-select are exact and deterministic. Typed answers
 * are the hard case: this module handles the local tiers of the grading
 * ladder (exact match, then keyword overlap) and reports back when it cannot
 * reach a confident verdict, rather than guessing. The next tier up, a binary
 * LLM judgment, is phase 4 and lives elsewhere; this module does not know it
 * exists.
 */

import type { AnswerResponse, MultiSelectQuestion, Question, SingleSelectQuestion, TypedQuestion } from './schema.js';

export type TypedVerdict = 'correct' | 'incorrect' | 'uncertain';

export interface GradeResult {
  correct: boolean;
  /** Set only for typed answers reaching 'uncertain'. Caller decides what to do next. */
  uncertain?: boolean;
}

/* ------------------------------------------------------------------ *
 * Single-select and multi-select: exact, no judgment calls
 * ------------------------------------------------------------------ */

function gradeSingleSelect(question: SingleSelectQuestion, selectedIndex: number): boolean {
  return selectedIndex === question.correctIndex;
}

/**
 * Correct only when the selected set exactly equals the correct set. Checking
 * "every correct option is present" alone would let selecting everything pass,
 * which the question design explicitly forbids.
 */
function gradeMultiSelect(question: MultiSelectQuestion, selectedIndices: number[]): boolean {
  const correct = new Set(question.correctIndices);
  const selected = new Set(selectedIndices);
  if (correct.size !== selected.size) return false;
  for (const i of correct) if (!selected.has(i)) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Typed answers
 * ------------------------------------------------------------------ */

const NEGATION_MARKERS = [
  // English. "n't" has no leading \b: the preceding letter (the "o" in
  // "don't") is a word character too, so there is no boundary immediately
  // before the "n". Only the trailing boundary is real, and it is enough to
  // avoid matching unrelated words that merely contain "nt".
  /\bnot\b/i, /\bnever\b/i, /\bno\b/i, /n't\b/i, /\bwithout\b/i,
  // Spanish, since the fallback bank is Spanish
  /\bnunca\b/i, /\btampoco\b/i, /\bsin\b/i, /\bjamás\b/i,
];

function hasNegation(text: string): boolean {
  return NEGATION_MARKERS.some((pattern) => pattern.test(text));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents, so "á" and "a" match
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips common endings so "manzanas" and "manzana" overlap as the same token. */
function stem(token: string): string {
  return token.replace(/(ciones|mente|ando|iendo|ados|adas|idos|idas|es|as|os|s)$/u, '');
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((t) => t.length > 1)
      .map(stem),
  );
}

const KEYWORD_OVERLAP_THRESHOLD = 0.6;

/**
 * The local tiers of the typed-answer ladder.
 *
 * 1. Exact or near-exact match against an example answer: confident accept.
 * 2. Keyword overlap above the threshold, with matching negation polarity:
 *    confident accept. Polarity is checked first and separately, because
 *    "plants do not need sunlight" shares every keyword with "plants need
 *    sunlight" and means the opposite; overlap alone cannot be trusted to
 *    accept across a negation mismatch.
 * 3. Anything else: uncertain. The caller sends it to the LLM (phase 4) or,
 *    with no LLM available, swaps in the fallback multiple-choice question
 *    rather than guessing.
 *
 * This function never returns a confident 'incorrect'. An answer that matches
 * nothing is still uncertain, not wrong, because local matching is not good
 * enough to fail her on a true negative with no second opinion.
 */
export function gradeTypedLocally(question: TypedQuestion, rawAnswer: string): TypedVerdict {
  const answer = normalize(rawAnswer);
  if (answer.length === 0) return 'uncertain';

  const exactTargets = [question.expectedConcept, ...question.exampleAnswers].map(normalize);
  if (exactTargets.includes(answer)) return 'correct';

  const answerTokens = tokenize(rawAnswer);
  if (answerTokens.size === 0) return 'uncertain';

  const conceptNegated = hasNegation(question.expectedConcept);
  const answerNegated = hasNegation(rawAnswer);

  for (const example of [question.expectedConcept, ...question.exampleAnswers]) {
    const exampleTokens = tokenize(example);
    if (exampleTokens.size === 0) continue;
    const overlap = intersection(answerTokens, exampleTokens).size / exampleTokens.size;
    if (overlap >= KEYWORD_OVERLAP_THRESHOLD) {
      // Polarity must agree before overlap is allowed to accept. A mismatch
      // here means the answer likely says the opposite of what matched.
      if (hasNegation(example) === conceptNegated && answerNegated !== conceptNegated) continue;
      return 'correct';
    }
  }

  const keywordTokens = new Set(question.keywords.flatMap((k) => [...tokenize(k)]));
  if (keywordTokens.size > 0) {
    const overlap = intersection(answerTokens, keywordTokens).size / keywordTokens.size;
    if (overlap >= KEYWORD_OVERLAP_THRESHOLD && answerNegated === conceptNegated) return 'correct';
  }

  return 'uncertain';
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const item of a) if (b.has(item)) out.add(item);
  return out;
}

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

/**
 * Grades one answer against its question. Typed answers that come back
 * 'uncertain' are reported as such rather than marked wrong, so the caller can
 * decide whether to ask the LLM or fall back to the multiple-choice twin.
 */
export function gradeAnswer(question: Question, response: AnswerResponse): GradeResult {
  if (question.type === 'singleSelect' && response.type === 'singleSelect') {
    return { correct: gradeSingleSelect(question, response.selectedIndex) };
  }
  if (question.type === 'multiSelect' && response.type === 'multiSelect') {
    return { correct: gradeMultiSelect(question, response.selectedIndices) };
  }
  if (question.type === 'typed' && response.type === 'typed') {
    const verdict = gradeTypedLocally(question, response.text);
    if (verdict === 'uncertain') return { correct: false, uncertain: true };
    return { correct: verdict === 'correct' };
  }
  // A response of the wrong shape for its question is a bug upstream, not a
  // wrong answer. Fail closed rather than crash the challenge screen.
  return { correct: false };
}
