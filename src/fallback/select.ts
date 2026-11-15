/**
 * Picks questions out of the fallback bank.
 *
 * Three constraints, in order of importance: respect the type mix a length
 * requires, avoid anything asked recently, and otherwise randomize. When one
 * type runs out of fresh questions, "avoid recent" is relaxed rather than
 * coming up empty-handed; see pickType below.
 */

import { CONFIG } from '../config.js';
import type { Question, QuestionType } from '../quiz/schema.js';
import type { RecentIds } from '../quiz/history.js';
import { wasRecentlyUsed } from '../quiz/history.js';
import { FALLBACK_BANK_ES } from './bank.es.js';

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

/**
 * Picks `count` questions of `type`, excluding ids already taken this quiz.
 * Prefers ones not recently asked, but falls back to recently-asked ones
 * rather than returning fewer than asked: a repeat is better than a quiz that
 * cannot be built. Recently-asked ones come back oldest first, so when a type
 * is exhausted (short quizzes only draw on one or two types, and fill the
 * window with them) the repeat is the question she saw longest ago, not one
 * from the previous quiz.
 */
function pickType(
  type: QuestionType,
  count: number,
  excludeIds: Set<string>,
  recent: RecentIds,
): Question[] {
  const candidates = FALLBACK_BANK_ES.filter((q) => q.type === type && !excludeIds.has(q.id));
  const fresh = shuffled(candidates.filter((q) => !wasRecentlyUsed(recent, q.id)));
  const stale = candidates
    .filter((q) => wasRecentlyUsed(recent, q.id))
    .sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  return [...fresh, ...stale].slice(0, count);
}

/**
 * The type mix for a quiz of this length. Fixed for five; relaxed below that.
 * Exported because the LLM path reuses this same length policy to trim a
 * freshly generated 3/1/1 bundle down to size, rather than duplicating it.
 */
export function typeMixFor(questionCount: number): Array<[QuestionType, number]> {
  if (questionCount >= 5) return [['singleSelect', 3], ['typed', 1], ['multiSelect', 1]];
  if (questionCount === 3) return [['singleSelect', 2], ['typed', 1]];
  return [['singleSelect', 1]];
}

export interface FallbackSelection {
  questions: Question[];
  spares: Question[];
}

export function selectFallbackQuiz(questionCount: number, recent: RecentIds): FallbackSelection {
  const used = new Set<string>();
  const questions: Question[] = [];

  for (const [type, count] of typeMixFor(questionCount)) {
    const picked = pickType(type, count, used, recent);
    for (const q of picked) used.add(q.id);
    questions.push(...picked);
  }

  const spares = pickType('singleSelect', CONFIG.quiz.spareCount, used, recent);
  for (const q of spares) used.add(q.id);

  return { questions: shuffled(questions), spares };
}

/** A pool for remediation, biased toward the easier end of the bank. */
export function selectRemediationPool(excludeIds: Set<string>, recent: RecentIds): Question[] {
  const easier = shuffled(
    FALLBACK_BANK_ES.filter((q) => !excludeIds.has(q.id) && (q.meta?.difficulty ?? 2) <= 2),
  );
  const rest = shuffled(FALLBACK_BANK_ES.filter((q) => !excludeIds.has(q.id) && !easier.includes(q)));
  const fresh = [...easier, ...rest].filter((q) => !wasRecentlyUsed(recent, q.id));
  const stale = [...easier, ...rest].filter((q) => wasRecentlyUsed(recent, q.id));
  return [...fresh, ...stale].slice(0, CONFIG.remediation.pooledQuestionCount);
}
