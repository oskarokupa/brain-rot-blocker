/**
 * Structural validation for a single question.
 *
 * This checks shape and format only: right number of options, exactly one
 * correct answer where that is the rule, no degenerate distractors. It cannot
 * judge whether a question is actually good, interesting, or fair, which is
 * why it is never the only line of defense. The fallback bank is hand
 * authored and reviewed; the LLM generator (next phase) adds a prompt steering
 * toward quality on top of this, because this validator cannot verify that.
 *
 * Nothing here is trusted output. Every question, wherever it comes from,
 * passes through here before it is ever shown to her.
 */

import { CONFIG } from '../config.js';
import type { MultiSelectQuestion, Question, SingleSelectQuestion, TypedQuestion } from './schema.js';

export interface ValidationResult {
  ok: boolean;
  /** Empty when ok. Human readable, for logs rather than the child. */
  problems: string[];
}

const BANNED_OPTION_PATTERNS = [/all of the above/i, /none of the above/i, /todas las anteriores/i, /ninguna de las anteriores/i];

function problemsFor(text: string, label: string): string[] {
  return text.trim().length === 0 ? [`${label} is empty`] : [];
}

function checkOptionSet(options: string[], label: string): string[] {
  const problems: string[] = [];
  if (options.some((o) => o.trim().length === 0)) problems.push(`${label}: an option is empty`);

  const normalized = options.map((o) => o.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) problems.push(`${label}: duplicate options`);

  if (options.some((o) => BANNED_OPTION_PATTERNS.some((p) => p.test(o)))) {
    problems.push(`${label}: uses an "all/none of the above" option`);
  }

  // A distractor far longer or shorter than the rest is a classic tell that
  // gives the answer away without anyone having to read for content.
  const lengths = options.map((o) => o.trim().length).filter((n) => n > 0);
  if (lengths.length > 1) {
    const shortest = Math.min(...lengths);
    const longest = Math.max(...lengths);
    if (shortest > 0 && longest > shortest * 3) {
      problems.push(`${label}: option lengths vary too much (${shortest} vs ${longest} chars)`);
    }
  }

  return problems;
}

function validateSingleSelect(q: SingleSelectQuestion): string[] {
  const problems = [...problemsFor(q.prompt, 'prompt'), ...checkOptionSet(q.options, 'options')];
  if (q.options.length < 2) problems.push('needs at least two options');
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
    problems.push('correctIndex is out of range');
  }
  return problems;
}

function validateMultiSelect(q: MultiSelectQuestion): string[] {
  const { minCorrect, maxCorrect, optionCount } = CONFIG.quiz.multiSelect;
  const problems = [...problemsFor(q.prompt, 'prompt'), ...checkOptionSet(q.options, 'options')];

  if (q.options.length !== optionCount) {
    problems.push(`expected ${optionCount} options, got ${q.options.length}`);
  }
  const unique = new Set(q.correctIndices);
  if (unique.size !== q.correctIndices.length) problems.push('correctIndices has duplicates');
  if (unique.size < minCorrect || unique.size > maxCorrect) {
    problems.push(`correctIndices must have ${minCorrect} to ${maxCorrect} entries, got ${unique.size}`);
  }
  if ([...unique].some((i) => !Number.isInteger(i) || i < 0 || i >= q.options.length)) {
    problems.push('correctIndices has an out-of-range entry');
  }
  // The whole point of multi-select is that selecting everything must not
  // count as correct. If every option were correct that guarantee is gone.
  if (unique.size === q.options.length) problems.push('every option is marked correct');
  return problems;
}

function validateTyped(q: TypedQuestion): string[] {
  const problems = [
    ...problemsFor(q.prompt, 'prompt'),
    ...problemsFor(q.expectedConcept, 'expectedConcept'),
  ];
  if (q.keywords.length === 0) problems.push('needs at least one keyword');
  if (q.exampleAnswers.length < 3) problems.push('needs at least three example answers');
  if (q.exampleAnswers.some((a) => a.trim().length === 0)) problems.push('an example answer is empty');
  if (!q.fallbackMultipleChoice) {
    problems.push('missing fallbackMultipleChoice');
  } else {
    problems.push(...validateSingleSelect(q.fallbackMultipleChoice).map((p) => `fallbackMultipleChoice: ${p}`));
  }
  return problems;
}

export function validateQuestion(question: Question): ValidationResult {
  const problems =
    question.type === 'singleSelect'
      ? validateSingleSelect(question)
      : question.type === 'multiSelect'
        ? validateMultiSelect(question)
        : validateTyped(question);
  return { ok: problems.length === 0, problems };
}

/** Flags questions that are word-for-word or near duplicates of each other. */
export function findDuplicates(questions: Question[]): number[] {
  const seen = new Map<string, number>();
  const duplicateIndices: number[] = [];
  questions.forEach((q, i) => {
    const key = q.prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) duplicateIndices.push(i);
    else seen.set(key, i);
  });
  return duplicateIndices;
}

export interface QuizValidationResult {
  ok: boolean;
  problems: string[];
}

/**
 * Validates a full set of questions against the length and type-mix rules for
 * that length. The five-question form is fixed at three single-select, one
 * typed, one multi-select; shorter forms just need to be internally valid,
 * since there is no room left to also enforce variety.
 */
export function validateQuizQuestions(questions: Question[], expectedCount: number): QuizValidationResult {
  const problems: string[] = [];

  if (questions.length !== expectedCount) {
    problems.push(`expected ${expectedCount} questions, got ${questions.length}`);
  }

  questions.forEach((q, i) => {
    const result = validateQuestion(q);
    if (!result.ok) problems.push(...result.problems.map((p) => `question ${i + 1}: ${p}`));
  });

  if (expectedCount === 5) {
    const counts = { singleSelect: 0, typed: 0, multiSelect: 0 };
    for (const q of questions) counts[q.type]++;
    if (counts.singleSelect !== 3 || counts.typed !== 1 || counts.multiSelect !== 1) {
      problems.push(
        `five question form needs 3 single-select, 1 typed, 1 multi-select; got ${counts.singleSelect}/${counts.typed}/${counts.multiSelect}`,
      );
    }
  }

  const duplicates = findDuplicates(questions);
  if (duplicates.length > 0) problems.push(`duplicate questions at index ${duplicates.join(', ')}`);

  return { ok: problems.length === 0, problems };
}
