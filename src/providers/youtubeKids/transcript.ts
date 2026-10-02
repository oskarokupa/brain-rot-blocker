/**
 * Parsing for the json3 caption format the YouTube player fetches.
 *
 * Shape, trimmed to what we use:
 *   { events: [ { tStartMs, dDurationMs, segs: [ { utf8 } ] } ] }
 *
 * Events with no segs are timing padding and carry no text.
 */

import type { Transcript, TranscriptCue } from '../types.js';

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
}

/** Sound annotations such as [Music] tell us nothing about the content. */
const ANNOTATION = /\[[^\]]{0,40}\]/g;

function cleanText(raw: string): string {
  return raw.replace(ANNOTATION, ' ').replace(/\s+/g, ' ').trim();
}

export function parseJson3(body: string): TranscriptCue[] {
  let parsed: { events?: Json3Event[] };
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const cues: TranscriptCue[] = [];
  for (const event of parsed.events ?? []) {
    if (!event.segs) continue;
    const text = cleanText(event.segs.map((s) => s.utf8 ?? '').join(''));
    if (!text) continue;
    cues.push({ startSeconds: Math.round((event.tStartMs ?? 0) / 1000), text });
  }
  return cues;
}

/**
 * How much of the video the cues actually cover. Generation waits on this
 * rather than on elapsed wall-clock time, because a caption file can arrive
 * whole and immediately or in pieces.
 */
export function computeCoverage(cues: TranscriptCue[], durationSeconds: number | null): number {
  if (cues.length === 0) return 0;
  if (!durationSeconds || durationSeconds <= 0) return 1;
  const last = cues[cues.length - 1];
  if (!last) return 0;
  return Math.min(1, last.startSeconds / durationSeconds);
}

export function buildTranscript(
  videoId: string,
  languageCode: string,
  isAutomatic: boolean,
  body: string,
  durationSeconds: number | null,
): Transcript | null {
  const cues = parseJson3(body);
  if (cues.length === 0) return null;
  return {
    videoId,
    languageCode,
    isAutomatic,
    cues,
    coverage: computeCoverage(cues, durationSeconds),
  };
}

/** Flattened text, capped, for sending upstream. */
export function transcriptToText(transcript: Transcript, maxChars: number): string {
  const text = transcript.cues.map((c) => c.text).join(' ');
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}
