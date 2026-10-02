import { describe, it, expect } from 'vitest';
import {
  parseJson3,
  computeCoverage,
  buildTranscript,
  transcriptToText,
} from '../src/providers/youtubeKids/transcript.js';

/** Shaped like the real player response captured from /api/timedtext. */
const SAMPLE = JSON.stringify({
  wireMagic: 'pb3',
  events: [
    { tStartMs: 0, dDurationMs: 100 },
    { tStartMs: 5261, dDurationMs: 2000, segs: [{ utf8: 'Sharks are ' }, { utf8: 'fish.' }] },
    { tStartMs: 9000, dDurationMs: 2000, segs: [{ utf8: '[Music]' }] },
    { tStartMs: 12000, dDurationMs: 2000, segs: [{ utf8: 'They have  many   teeth' }] },
  ],
});

describe('json3 parsing', () => {
  it('keeps only events carrying text', () => {
    const cues = parseJson3(SAMPLE);
    expect(cues).toHaveLength(2);
  });

  it('joins segments and normalises whitespace', () => {
    const cues = parseJson3(SAMPLE);
    expect(cues[0]).toEqual({ startSeconds: 5, text: 'Sharks are fish.' });
    expect(cues[1]?.text).toBe('They have many teeth');
  });

  it('drops sound annotations that say nothing about content', () => {
    const cues = parseJson3(SAMPLE);
    expect(cues.some((c) => c.text.includes('Music'))).toBe(false);
  });

  it('survives malformed input rather than throwing', () => {
    expect(parseJson3('not json')).toEqual([]);
    expect(parseJson3('{}')).toEqual([]);
    expect(parseJson3('{"events":null}')).toEqual([]);
  });

  it('returns nothing for the empty body an unauthorised caption URL gives', () => {
    expect(parseJson3('')).toEqual([]);
  });
});

describe('coverage', () => {
  it('is zero with no cues', () => {
    expect(computeCoverage([], 100)).toBe(0);
  });

  it('reports the share of the video the cues reach', () => {
    const cues = [{ startSeconds: 50, text: 'a' }];
    expect(computeCoverage(cues, 100)).toBe(0.5);
  });

  it('never exceeds one even when cues run past the stated duration', () => {
    expect(computeCoverage([{ startSeconds: 200, text: 'a' }], 100)).toBe(1);
  });

  it('assumes full coverage when duration is unknown', () => {
    expect(computeCoverage([{ startSeconds: 10, text: 'a' }], null)).toBe(1);
  });
});

describe('buildTranscript', () => {
  it('returns null when nothing usable was captured', () => {
    expect(buildTranscript('abc', 'en', true, '', 100)).toBeNull();
    expect(buildTranscript('abc', 'en', true, '{"events":[]}', 100)).toBeNull();
  });

  it('carries the language and automatic flag through', () => {
    const t = buildTranscript('abc', 'en', false, SAMPLE, 30);
    expect(t).not.toBeNull();
    expect(t!.videoId).toBe('abc');
    expect(t!.languageCode).toBe('en');
    expect(t!.isAutomatic).toBe(false);
    expect(t!.cues).toHaveLength(2);
  });
});

describe('transcriptToText', () => {
  it('caps length so an oversized transcript cannot be sent upstream', () => {
    const t = buildTranscript('abc', 'en', true, SAMPLE, 30)!;
    expect(transcriptToText(t, 10)).toHaveLength(10);
    expect(transcriptToText(t, 1000)).toBe('Sharks are fish. They have many teeth');
  });
});
