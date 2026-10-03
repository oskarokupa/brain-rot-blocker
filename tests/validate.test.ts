import { describe, it, expect } from 'vitest';
import { validateQuestion, validateQuizQuestions, findDuplicates } from '../src/quiz/validate.js';
import type { MultiSelectQuestion, Question, SingleSelectQuestion, TypedQuestion } from '../src/quiz/schema.js';

function validSingle(overrides: Partial<SingleSelectQuestion> = {}): SingleSelectQuestion {
  return {
    id: 's1', type: 'singleSelect', prompt: 'What colour is the sky?', explanation: 'e',
    options: ['Blue', 'Green', 'Purple'], correctIndex: 0,
    ...overrides,
  };
}

function validMulti(overrides: Partial<MultiSelectQuestion> = {}): MultiSelectQuestion {
  return {
    id: 'm1', type: 'multiSelect', prompt: 'Pick the even numbers', explanation: 'e',
    options: ['2', '3', '4', '5', '6'], correctIndices: [0, 2, 4],
    ...overrides,
  };
}

function validTyped(overrides: Partial<TypedQuestion> = {}): TypedQuestion {
  return {
    id: 't1', type: 'typed', prompt: 'What is 2+2?', explanation: 'e',
    expectedConcept: '4', keywords: ['4', 'four'], exampleAnswers: ['4', 'four', 'Four'],
    fallbackMultipleChoice: validSingle({ id: 't1-mc', prompt: 'What is 2+2?' }),
    ...overrides,
  };
}

describe('validateQuestion: this validator is a structural check, not a quality one', () => {
  it('accepts a well-formed question of every type', () => {
    expect(validateQuestion(validSingle()).ok).toBe(true);
    expect(validateQuestion(validMulti()).ok).toBe(true);
    expect(validateQuestion(validTyped()).ok).toBe(true);
  });

  it('rejects an empty prompt', () => {
    expect(validateQuestion(validSingle({ prompt: '  ' })).ok).toBe(false);
  });

  it('rejects a single-select question with an out-of-range correct index', () => {
    expect(validateQuestion(validSingle({ correctIndex: 9 })).ok).toBe(false);
  });

  it('rejects duplicate options', () => {
    expect(validateQuestion(validSingle({ options: ['Blue', 'blue', 'Green'] })).ok).toBe(false);
  });

  it('rejects "all of the above" style options', () => {
    expect(validateQuestion(validSingle({ options: ['Blue', 'Green', 'All of the above'] })).ok).toBe(false);
  });

  it('rejects "none of the above" in Spanish too', () => {
    expect(validateQuestion(validSingle({ options: ['Azul', 'Verde', 'Ninguna de las anteriores'] })).ok).toBe(false);
  });

  it('rejects an option wildly longer than the others, a classic answer tell', () => {
    expect(
      validateQuestion(
        validSingle({ options: ['Blue', 'Green', 'A very long and oddly specific description of the answer'] }),
      ).ok,
    ).toBe(false);
  });
});

describe('validateQuestion: multi-select', () => {
  it('rejects fewer than two correct answers', () => {
    expect(validateQuestion(validMulti({ correctIndices: [0] })).ok).toBe(false);
  });

  it('rejects more than three correct answers', () => {
    expect(validateQuestion(validMulti({ correctIndices: [0, 1, 2, 3] })).ok).toBe(false);
  });

  it('rejects every option marked correct', () => {
    expect(validateQuestion(validMulti({ correctIndices: [0, 1, 2, 3, 4] })).ok).toBe(false);
  });

  it('rejects the wrong number of options', () => {
    expect(validateQuestion(validMulti({ options: ['a', 'b', 'c'] })).ok).toBe(false);
  });

  it('rejects an out-of-range correct index', () => {
    expect(validateQuestion(validMulti({ correctIndices: [0, 99] })).ok).toBe(false);
  });
});

describe('validateQuestion: typed', () => {
  it('rejects fewer than three example answers', () => {
    expect(validateQuestion(validTyped({ exampleAnswers: ['4', 'four'] })).ok).toBe(false);
  });

  it('rejects no keywords', () => {
    expect(validateQuestion(validTyped({ keywords: [] })).ok).toBe(false);
  });

  it('rejects a missing fallback multiple-choice', () => {
    const q = validTyped();
    // @ts-expect-error deliberately malformed for the test
    expect(validateQuestion({ ...q, fallbackMultipleChoice: undefined }).ok).toBe(false);
  });

  it('rejects a malformed fallback multiple-choice', () => {
    expect(
      validateQuestion(validTyped({ fallbackMultipleChoice: validSingle({ correctIndex: 99 }) })).ok,
    ).toBe(false);
  });
});

describe('findDuplicates', () => {
  it('flags a question repeated word for word', () => {
    const questions: Question[] = [validSingle({ id: 'a' }), validSingle({ id: 'b' })];
    expect(findDuplicates(questions)).toEqual([1]);
  });

  it('is case and whitespace insensitive', () => {
    const questions: Question[] = [
      validSingle({ id: 'a', prompt: 'What colour is the sky?' }),
      validSingle({ id: 'b', prompt: '  WHAT COLOUR IS THE SKY?  ' }),
    ];
    expect(findDuplicates(questions)).toEqual([1]);
  });

  it('finds nothing among distinct prompts', () => {
    const questions: Question[] = [validSingle({ id: 'a' }), validMulti({ id: 'b' })];
    expect(findDuplicates(questions)).toEqual([]);
  });
});

describe('validateQuizQuestions', () => {
  it('accepts a correctly shaped five-question quiz', () => {
    const questions: Question[] = [
      validSingle({ id: 's1', prompt: 'p1' }),
      validSingle({ id: 's2', prompt: 'p2' }),
      validSingle({ id: 's3', prompt: 'p3' }),
      validTyped({ id: 't1', prompt: 'p4' }),
      validMulti({ id: 'm1', prompt: 'p5' }),
    ];
    const result = validateQuizQuestions(questions, 5);
    expect(result.ok, result.problems.join('; ')).toBe(true);
  });

  it('rejects the wrong question count', () => {
    const result = validateQuizQuestions([validSingle()], 5);
    expect(result.ok).toBe(false);
  });

  it('rejects a five-question quiz with the wrong type mix', () => {
    const questions: Question[] = [
      validSingle({ id: 's1', prompt: 'p1' }),
      validSingle({ id: 's2', prompt: 'p2' }),
      validSingle({ id: 's3', prompt: 'p3' }),
      validSingle({ id: 's4', prompt: 'p4' }),
      validSingle({ id: 's5', prompt: 'p5' }),
    ];
    const result = validateQuizQuestions(questions, 5);
    expect(result.ok).toBe(false);
  });

  it('does not enforce a type mix below five questions', () => {
    const questions: Question[] = [validSingle({ id: 's1', prompt: 'p1' }), validSingle({ id: 's2', prompt: 'p2' })];
    // Not the five-question shape, so just needs internal validity, which it has.
    const result = validateQuizQuestions(questions, 2);
    expect(result.ok).toBe(true);
  });

  it('rejects a quiz containing a duplicated question', () => {
    const questions: Question[] = [validSingle({ id: 's1', prompt: 'same' }), validSingle({ id: 's2', prompt: 'same' })];
    const result = validateQuizQuestions(questions, 2);
    expect(result.ok).toBe(false);
  });
});
