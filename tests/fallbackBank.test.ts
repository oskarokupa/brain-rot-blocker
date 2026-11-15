import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { FALLBACK_BANK_ES } from '../src/fallback/bank.es.js';
import { selectFallbackQuiz, selectRemediationPool } from '../src/fallback/select.js';
import { buildFallbackQuiz } from '../src/quiz/build.js';
import { recordUsed } from '../src/quiz/history.js';
import { validateQuestion, validateQuizQuestions } from '../src/quiz/validate.js';

describe('every bank entry is individually valid', () => {
  it.each(FALLBACK_BANK_ES.map((q) => [q.id, q] as const))('%s', (_id, question) => {
    const result = validateQuestion(question);
    expect(result.ok, result.problems.join('; ')).toBe(true);
  });

  it('has unique ids', () => {
    const ids = FALLBACK_BANK_ES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate prompts', () => {
    const prompts = FALLBACK_BANK_ES.map((q) => q.prompt.trim().toLowerCase());
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('covers every subject and all three question types', () => {
    const subjects = new Set(FALLBACK_BANK_ES.map((q) => q.meta?.subject));
    const types = new Set(FALLBACK_BANK_ES.map((q) => q.type));
    expect(subjects).toEqual(new Set(['matematicas', 'lengua', 'medio']));
    expect(types).toEqual(new Set(['singleSelect', 'multiSelect', 'typed']));
  });

  it('holds at least 200 questions, with no subject left thin', () => {
    expect(FALLBACK_BANK_ES.length).toBeGreaterThanOrEqual(200);
    for (const subject of ['matematicas', 'lengua', 'medio']) {
      const count = FALLBACK_BANK_ES.filter((q) => q.meta?.subject === subject).length;
      expect(count, subject).toBeGreaterThanOrEqual(55);
    }
  });

  it('has every question type and every difficulty in each subject', () => {
    for (const subject of ['matematicas', 'lengua', 'medio']) {
      const inSubject = FALLBACK_BANK_ES.filter((q) => q.meta?.subject === subject);
      expect(new Set(inSubject.map((q) => q.type)).size, subject).toBe(3);
      expect(new Set(inSubject.map((q) => q.meta?.difficulty)), subject).toEqual(new Set([1, 2, 3]));
    }
  });

  it('keeps the type share close to the 3/1/1 shape of a five-question quiz', () => {
    const share = (type: string) => FALLBACK_BANK_ES.filter((q) => q.type === type).length / FALLBACK_BANK_ES.length;
    expect(share('singleSelect')).toBeGreaterThanOrEqual(0.55);
    expect(share('typed')).toBeGreaterThanOrEqual(0.15);
    expect(share('multiSelect')).toBeGreaterThanOrEqual(0.15);
  });

  it('does not favour one answer position in single-select questions', () => {
    // A bank that leans on "b" teaches her to guess "b".
    const positions = [0, 0, 0, 0];
    let total = 0;
    for (const q of FALLBACK_BANK_ES) {
      if (q.type !== 'singleSelect') continue;
      positions[q.correctIndex] = (positions[q.correctIndex] ?? 0) + 1;
      total++;
    }
    expect(Math.max(...positions) / total).toBeLessThanOrEqual(0.4);
  });

  it('leaves room to pick fresh questions once the no-repeat window is full', () => {
    expect(CONFIG.fallback.noRepeatWindow).toBeLessThan(FALLBACK_BANK_ES.length);
  });

  it('gives every typed question a fallback with the same subject and difficulty', () => {
    for (const q of FALLBACK_BANK_ES) {
      if (q.type !== 'typed') continue;
      expect(q.fallbackMultipleChoice.meta?.subject, q.id).toBe(q.meta?.subject);
      expect(q.fallbackMultipleChoice.meta?.difficulty, q.id).toBe(q.meta?.difficulty);
    }
  });

  it('has enough of each type to build a five-question quiz without emptying the bank', () => {
    const counts = { singleSelect: 0, typed: 0, multiSelect: 0 };
    for (const q of FALLBACK_BANK_ES) counts[q.type]++;
    // 3 single-select + 2 spares need at least 5; typed and multiSelect need 1 each.
    expect(counts.singleSelect).toBeGreaterThanOrEqual(5);
    expect(counts.typed).toBeGreaterThanOrEqual(1);
    expect(counts.multiSelect).toBeGreaterThanOrEqual(1);
  });
});

describe('selectFallbackQuiz', () => {
  it('builds the fixed five-question type mix', () => {
    const { questions } = selectFallbackQuiz(5, []);
    const counts = { singleSelect: 0, typed: 0, multiSelect: 0 };
    for (const q of questions) counts[q.type]++;
    expect(counts).toEqual({ singleSelect: 3, typed: 1, multiSelect: 1 });
  });

  it('builds a single question for the shortest length', () => {
    const { questions } = selectFallbackQuiz(1, []);
    expect(questions).toHaveLength(1);
  });

  it('never repeats a question within the same quiz, including the spares', () => {
    const { questions, spares } = selectFallbackQuiz(5, []);
    const ids = [...questions, ...spares].map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces the configured number of spares', () => {
    const { spares } = selectFallbackQuiz(5, []);
    expect(spares).toHaveLength(CONFIG.quiz.spareCount);
  });

  it('prefers questions outside the recent history when enough are available', () => {
    // Exclude every single-select question except one: selection should still
    // reach for the one untouched id rather than ignoring history entirely.
    const singleSelectIds = FALLBACK_BANK_ES.filter((q) => q.type === 'singleSelect').map((q) => q.id);
    const keepFree = singleSelectIds[0];
    let recent: string[] = [];
    for (const id of singleSelectIds) if (id !== keepFree) recent = recordUsed(recent, id, singleSelectIds.length);

    const { questions } = selectFallbackQuiz(1, recent);
    expect(questions[0]?.id).toBe(keepFree);
  });

  it('repeats the question seen longest ago when every candidate is recent', () => {
    const singleSelectIds = FALLBACK_BANK_ES.filter((q) => q.type === 'singleSelect').map((q) => q.id);
    let recent: string[] = [];
    for (const id of singleSelectIds) recent = recordUsed(recent, id, singleSelectIds.length);

    const { questions } = selectFallbackQuiz(1, recent);
    expect(questions[0]?.id).toBe(singleSelectIds[0]);
  });

  it('still returns a full quiz even when every candidate has been seen recently', () => {
    const allIds = FALLBACK_BANK_ES.map((q) => q.id);
    let recent: string[] = [];
    for (const id of allIds) recent = recordUsed(recent, id, allIds.length);
    const { questions } = selectFallbackQuiz(5, recent);
    expect(questions).toHaveLength(5);
  });
});

describe('selectRemediationPool', () => {
  it('returns the configured pool size when enough questions are free', () => {
    const pool = selectRemediationPool(new Set(), []);
    expect(pool).toHaveLength(CONFIG.remediation.pooledQuestionCount);
  });

  it('excludes ids already used in the main quiz', () => {
    const used = new Set(FALLBACK_BANK_ES.slice(0, 10).map((q) => q.id));
    const pool = selectRemediationPool(used, []);
    expect(pool.some((q) => used.has(q.id))).toBe(false);
  });
});

describe('buildFallbackQuiz', () => {
  it('produces a quiz that passes full validation', () => {
    const quiz = buildFallbackQuiz({ videoId: 'v1', durationSeconds: 400, recentQuestionIds: [] });
    const result = validateQuizQuestions(quiz.questions, 5);
    expect(result.ok, result.problems.join('; ')).toBe(true);
  });

  it('sizes the quiz to the video duration', () => {
    expect(buildFallbackQuiz({ videoId: null, durationSeconds: 30, recentQuestionIds: [] }).questions).toHaveLength(1);
    expect(buildFallbackQuiz({ videoId: null, durationSeconds: 120, recentQuestionIds: [] }).questions).toHaveLength(3);
    expect(buildFallbackQuiz({ videoId: null, durationSeconds: 400, recentQuestionIds: [] }).questions).toHaveLength(5);
  });

  it('builds a remediation pool with no overlap with the main quiz', () => {
    const quiz = buildFallbackQuiz({ videoId: 'v1', durationSeconds: 400, recentQuestionIds: [] });
    const mainIds = new Set([...quiz.questions, ...quiz.spares].map((q) => q.id));
    expect(quiz.remediationPool.some((q) => mainIds.has(q.id))).toBe(false);
  });

  it('tags the quiz as coming from the fallback source', () => {
    expect(buildFallbackQuiz({ videoId: 'v1', durationSeconds: 400, recentQuestionIds: [] }).source).toBe('fallback');
  });
});
