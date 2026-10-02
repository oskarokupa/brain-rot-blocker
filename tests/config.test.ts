import { describe, it, expect } from 'vitest';
import {
  CONFIG,
  questionCountForDuration,
  passMarkForCount,
  watchThresholdForDuration,
} from '../src/config.js';

describe('quiz length bands', () => {
  it('gives one question to very short videos', () => {
    expect(questionCountForDuration(30)).toBe(1);
    expect(questionCountForDuration(60)).toBe(1);
  });

  it('gives three questions to mid length videos', () => {
    expect(questionCountForDuration(61)).toBe(3);
    expect(questionCountForDuration(180)).toBe(3);
  });

  it('gives five questions to anything longer', () => {
    expect(questionCountForDuration(181)).toBe(5);
    expect(questionCountForDuration(6272)).toBe(5);
  });
});

describe('pass marks', () => {
  it('demands everything on the short forms, since there is no margin', () => {
    expect(passMarkForCount(1)).toBe(1);
    expect(passMarkForCount(3)).toBe(3);
  });

  it('allows one miss on the full five question form', () => {
    expect(passMarkForCount(5)).toBe(4);
  });

  it('never returns a mark above the question count', () => {
    for (const n of [1, 3, 5]) {
      expect(passMarkForCount(n)).toBeLessThanOrEqual(n);
    }
  });
});

describe('watch threshold', () => {
  it('uses the flat threshold for long videos', () => {
    expect(watchThresholdForDuration(600)).toBe(CONFIG.watch.thresholdSeconds);
  });

  it('scales down for short videos so a quarter of the video still counts', () => {
    expect(watchThresholdForDuration(40)).toBe(10);
    expect(watchThresholdForDuration(20)).toBe(5);
  });

  it('falls back to the flat threshold when duration is unknown', () => {
    expect(watchThresholdForDuration(0)).toBe(CONFIG.watch.thresholdSeconds);
    expect(watchThresholdForDuration(NaN)).toBe(CONFIG.watch.thresholdSeconds);
  });
});
