import { describe, it, expect } from 'vitest';
import { gradeAnswer, gradeTypedLocally } from '../src/quiz/grade.js';
import type { MultiSelectQuestion, SingleSelectQuestion, TypedQuestion } from '../src/quiz/schema.js';

const single: SingleSelectQuestion = {
  id: 'q1', type: 'singleSelect', prompt: 'p', explanation: 'e',
  options: ['a', 'b', 'c'], correctIndex: 1,
};

const multi: MultiSelectQuestion = {
  id: 'q2', type: 'multiSelect', prompt: 'p', explanation: 'e',
  options: ['a', 'b', 'c', 'd', 'e'], correctIndices: [0, 2],
};

const typed: TypedQuestion = {
  id: 'q3', type: 'typed', prompt: 'Why did she go back?',
  expectedConcept: 'She forgot her backpack',
  keywords: ['forgot', 'backpack'],
  exampleAnswers: ['She forgot her backpack.', 'Her backpack was still there.', 'She left her bag behind.'],
  fallbackMultipleChoice: {
    id: 'q3-mc', type: 'singleSelect', prompt: 'Why did she go back?', explanation: 'e',
    options: ['She forgot her backpack', 'She wanted a snack', 'It started raining'], correctIndex: 0,
  },
  explanation: 'e',
};

describe('single-select', () => {
  it('is correct only on the exact index', () => {
    expect(gradeAnswer(single, { type: 'singleSelect', selectedIndex: 1 }).correct).toBe(true);
    expect(gradeAnswer(single, { type: 'singleSelect', selectedIndex: 0 }).correct).toBe(false);
  });
});

describe('multi-select', () => {
  it('is correct on an exact match', () => {
    expect(gradeAnswer(multi, { type: 'multiSelect', selectedIndices: [0, 2] }).correct).toBe(true);
    expect(gradeAnswer(multi, { type: 'multiSelect', selectedIndices: [2, 0] }).correct).toBe(true);
  });

  it('fails a partial selection', () => {
    expect(gradeAnswer(multi, { type: 'multiSelect', selectedIndices: [0] }).correct).toBe(false);
  });

  it('fails a superset, so selecting everything cannot pass', () => {
    expect(gradeAnswer(multi, { type: 'multiSelect', selectedIndices: [0, 1, 2, 3, 4] }).correct).toBe(false);
  });

  it('fails an empty selection', () => {
    expect(gradeAnswer(multi, { type: 'multiSelect', selectedIndices: [] }).correct).toBe(false);
  });
});

describe('typed answers: local matching', () => {
  it('accepts the expected concept verbatim', () => {
    expect(gradeTypedLocally(typed, 'She forgot her backpack')).toBe('correct');
  });

  it('accepts a listed example answer', () => {
    expect(gradeTypedLocally(typed, 'She left her bag behind.')).toBe('correct');
  });

  it('accepts close paraphrases via keyword overlap', () => {
    expect(gradeTypedLocally(typed, 'she forgot her backpack at home')).toBe('correct');
  });

  it('is case and accent insensitive', () => {
    const q: TypedQuestion = { ...typed, expectedConcept: 'Había un árbol', keywords: ['arbol'], exampleAnswers: ['Había un árbol', 'Un árbol', 'Era un árbol'] };
    expect(gradeTypedLocally(q, 'HABIA UN ARBOL')).toBe('correct');
  });

  it('is uncertain, not wrong, on an unrelated answer', () => {
    expect(gradeTypedLocally(typed, 'bananas and rockets')).toBe('uncertain');
  });

  it('is uncertain on an empty answer', () => {
    expect(gradeTypedLocally(typed, '')).toBe('uncertain');
    expect(gradeTypedLocally(typed, '   ')).toBe('uncertain');
  });

  it('never returns a confident incorrect', () => {
    // Local matching should hand anything it is not sure about back as
    // uncertain, since it has no second opinion to fall back on.
    const verdicts = ['nope', 'not sure', 'maybe tomorrow', '42'].map((a) => gradeTypedLocally(typed, a));
    expect(verdicts.every((v) => v !== 'incorrect')).toBe(true);
  });
});

describe('typed answers: the negation guard', () => {
  const sunlight: TypedQuestion = {
    id: 'q4', type: 'typed', prompt: 'Why do plants need light?',
    expectedConcept: 'Plants need sunlight to grow',
    keywords: ['plants', 'sunlight', 'grow'],
    exampleAnswers: ['Plants need sunlight to grow.', 'They use sunlight to grow.', 'Sunlight helps them grow.'],
    fallbackMultipleChoice: {
      id: 'q4-mc', type: 'singleSelect', prompt: 'Why do plants need light?', explanation: 'e',
      options: ['To grow using sunlight', 'To stay cool', 'To attract bees'], correctIndex: 0,
    },
    explanation: 'e',
  };

  it('does not accept the negated form despite near-total keyword overlap', () => {
    // "Plants do not need sunlight" shares every keyword with the expected
    // concept and means the opposite. Overlap alone must not accept this.
    expect(gradeTypedLocally(sunlight, 'Plants do not need sunlight')).not.toBe('correct');
  });

  it('still accepts a correctly phrased paraphrase', () => {
    expect(gradeTypedLocally(sunlight, 'They need sunlight to grow')).toBe('correct');
  });

  it('reports the negated case as uncertain rather than a confident wrong answer', () => {
    // No LLM to ask in this phase, so an uncertain answer is handled by
    // swapping to the multiple-choice twin, never by silently failing her.
    expect(gradeTypedLocally(sunlight, "Plants don't need sunlight")).toBe('uncertain');
  });
});

describe('gradeAnswer dispatch', () => {
  it('reports uncertain for a typed answer with no confident verdict', () => {
    const result = gradeAnswer(typed, { type: 'typed', text: 'bananas and rockets' });
    expect(result.correct).toBe(false);
    expect(result.uncertain).toBe(true);
  });

  it('fails closed on a mismatched response shape rather than throwing', () => {
    expect(gradeAnswer(single, { type: 'typed', text: 'a' }).correct).toBe(false);
  });
});
