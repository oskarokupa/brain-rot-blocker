import { describe, it, expect } from 'vitest';
import { recordUsed, wasRecentlyUsed, recordVideoQuestions, promptsForVideo } from '../src/quiz/history.js';

describe('recordUsed / wasRecentlyUsed', () => {
  it('reports a freshly recorded id as recently used', () => {
    const recent = recordUsed([], 'a', 5);
    expect(wasRecentlyUsed(recent, 'a')).toBe(true);
    expect(wasRecentlyUsed(recent, 'b')).toBe(false);
  });

  it('drops the oldest entries once the window is exceeded', () => {
    let recent: string[] = [];
    for (const id of ['a', 'b', 'c', 'd']) recent = recordUsed(recent, id, 3);
    expect(recent).toEqual(['b', 'c', 'd']);
    expect(wasRecentlyUsed(recent, 'a')).toBe(false);
  });

  it('moves a re-recorded id to the back rather than duplicating it', () => {
    let recent: string[] = [];
    for (const id of ['a', 'b', 'c']) recent = recordUsed(recent, id, 5);
    recent = recordUsed(recent, 'a', 5);
    expect(recent).toEqual(['b', 'c', 'a']);
  });
});

describe('per-video question history', () => {
  it('records prompts for a video', () => {
    const history = recordVideoQuestions([], 'v1', ['q1', 'q2']);
    expect(promptsForVideo(history, 'v1')).toEqual(['q1', 'q2']);
  });

  it('merges new prompts onto the same video', () => {
    let history = recordVideoQuestions([], 'v1', ['q1']);
    history = recordVideoQuestions(history, 'v1', ['q2']);
    expect(promptsForVideo(history, 'v1')).toEqual(['q1', 'q2']);
  });

  it('keeps videos separate', () => {
    let history = recordVideoQuestions([], 'v1', ['q1']);
    history = recordVideoQuestions(history, 'v2', ['q2']);
    expect(promptsForVideo(history, 'v1')).toEqual(['q1']);
    expect(promptsForVideo(history, 'v2')).toEqual(['q2']);
  });

  it('bounds the number of videos remembered', () => {
    let history: ReturnType<typeof recordVideoQuestions> = [];
    for (let i = 0; i < 25; i++) history = recordVideoQuestions(history, `v${i}`, ['q']);
    expect(history.length).toBeLessThanOrEqual(20);
    expect(promptsForVideo(history, 'v0')).toEqual([]); // the oldest should be gone
    expect(promptsForVideo(history, 'v24')).toEqual(['q']);
  });

  it('bounds the number of prompts remembered per video', () => {
    let history: ReturnType<typeof recordVideoQuestions> = [];
    for (let i = 0; i < 20; i++) history = recordVideoQuestions(history, 'v1', [`q${i}`]);
    expect(promptsForVideo(history, 'v1').length).toBeLessThanOrEqual(15);
  });
});
