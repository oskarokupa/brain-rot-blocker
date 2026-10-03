import { describe, it, expect } from 'vitest';
import {
  currentQuestion,
  discardCurrentQuestion,
  isRoundComplete,
  replaceCurrentQuestion,
  scoreRound,
  startRound,
  submitAnswer,
} from '../src/quiz/engine.js';
import type { SingleSelectQuestion } from '../src/quiz/schema.js';

function sq(id: string, correctIndex = 0): SingleSelectQuestion {
  return { id, type: 'singleSelect', prompt: id, explanation: `${id} explanation`, options: ['a', 'b', 'c'], correctIndex };
}

describe('round progression', () => {
  it('starts with the first question current and nothing answered', () => {
    const round = startRound([sq('q1'), sq('q2')], [], 2);
    expect(currentQuestion(round)?.id).toBe('q1');
    expect(isRoundComplete(round)).toBe(false);
  });

  it('advances to the next question after each answer', () => {
    let round = startRound([sq('q1'), sq('q2')], [], 2);
    round = submitAnswer(round, { type: 'singleSelect', selectedIndex: 0 }).round;
    expect(currentQuestion(round)?.id).toBe('q2');
  });

  it('is complete once every question has an answer', () => {
    let round = startRound([sq('q1')], [], 2);
    round = submitAnswer(round, { type: 'singleSelect', selectedIndex: 0 }).round;
    expect(isRoundComplete(round)).toBe(true);
    expect(currentQuestion(round)).toBeNull();
  });

  it('does nothing if submitted after the round is already complete', () => {
    let round = startRound([sq('q1')], [], 2);
    round = submitAnswer(round, { type: 'singleSelect', selectedIndex: 0 }).round;
    const result = submitAnswer(round, { type: 'singleSelect', selectedIndex: 0 });
    expect(result.round.answers).toHaveLength(1);
  });
});

describe('scoring', () => {
  it('passes a 5-question round at 4 correct', () => {
    let round = startRound([sq('a'), sq('b'), sq('c'), sq('d'), sq('e')], [], 0);
    for (const correct of [true, true, true, true, false]) {
      round = submitAnswer(round, { type: 'singleSelect', selectedIndex: correct ? 0 : 1 }).round;
    }
    const score = scoreRound(round);
    expect(score).toEqual({ correctCount: 4, total: 5, passed: true });
  });

  it('fails a 5-question round at 3 correct', () => {
    let round = startRound([sq('a'), sq('b'), sq('c'), sq('d'), sq('e')], [], 0);
    for (const correct of [true, true, true, false, false]) {
      round = submitAnswer(round, { type: 'singleSelect', selectedIndex: correct ? 0 : 1 }).round;
    }
    expect(scoreRound(round).passed).toBe(false);
  });

  it('demands a perfect score on a single-question round', () => {
    let round = startRound([sq('a')], [], 0);
    round = submitAnswer(round, { type: 'singleSelect', selectedIndex: 1 }).round;
    expect(scoreRound(round).passed).toBe(false);
  });

  it('demands a perfect score on a three-question round', () => {
    let round = startRound([sq('a'), sq('b'), sq('c')], [], 0);
    for (const correct of [true, true, false]) {
      round = submitAnswer(round, { type: 'singleSelect', selectedIndex: correct ? 0 : 1 }).round;
    }
    expect(scoreRound(round).passed).toBe(false);
  });
});

describe('discarding a question', () => {
  it('replaces the current question without consuming a question slot', () => {
    const round = startRound([sq('a'), sq('b')], [sq('spare')], 2);
    const result = discardCurrentQuestion(round);
    expect(result.ok).toBe(true);
    expect(currentQuestion(result.round)?.id).toBe('spare');
    expect(result.round.questions).toHaveLength(2);
  });

  it('does not count as a wrong answer', () => {
    const round = startRound([sq('a')], [sq('spare')], 1);
    const result = discardCurrentQuestion(round);
    expect(result.round.answers).toHaveLength(0);
  });

  it('is refused once the discard allowance is spent', () => {
    let round = startRound([sq('a'), sq('b'), sq('c')], [sq('s1'), sq('s2')], 2);
    round = discardCurrentQuestion(round).round;
    round = discardCurrentQuestion(round).round;
    const third = discardCurrentQuestion(round);
    expect(third.ok).toBe(false);
  });

  it('is refused when no spares remain, even with allowance left', () => {
    const round = startRound([sq('a')], [], 2);
    const result = discardCurrentQuestion(round);
    expect(result.ok).toBe(false);
  });
});

describe('replacing a question for an uncertain typed answer', () => {
  it('swaps the current slot without touching discards', () => {
    const round = startRound([sq('a'), sq('b')], [], 2);
    const replaced = replaceCurrentQuestion(round, sq('replacement'));
    expect(currentQuestion(replaced)?.id).toBe('replacement');
    expect(replaced.discardsUsed).toBe(0);
  });

  it('does not touch the spares queue', () => {
    const round = startRound([sq('a')], [sq('spare')], 1);
    const replaced = replaceCurrentQuestion(round, sq('replacement'));
    expect(replaced.spares).toHaveLength(1);
  });
});

describe('submitAnswer uncertainty', () => {
  it('does not record an answer for an uncertain typed response', () => {
    const typedQuestion = {
      id: 't1', type: 'typed' as const, prompt: 'p', explanation: 'e',
      expectedConcept: 'x', keywords: ['x'], exampleAnswers: ['x', 'xx', 'xxx'],
      fallbackMultipleChoice: sq('t1-mc'),
    };
    const round = startRound([typedQuestion], [], 0);
    const result = submitAnswer(round, { type: 'typed', text: 'totally unrelated' });
    expect(result.uncertain).toBe(true);
    expect(result.round.answers).toHaveLength(0);
    expect(currentQuestion(result.round)?.id).toBe('t1');
  });
});
