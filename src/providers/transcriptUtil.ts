/**
 * Transcript utilities with no provider-specific logic.
 *
 * Lives outside providers/youtubeKids/ on purpose, even though the YouTube
 * Kids provider is the only thing building Transcript objects today: this
 * operates purely on the generic Transcript shape from types.ts, and the
 * service worker (a core, provider-independent system) needs it to turn a
 * captured transcript into text for the LLM without importing anything from
 * inside a specific provider's folder.
 */

import type { Transcript } from './types.js';

/** Flattened text, capped, for sending upstream. */
export function transcriptToText(transcript: Transcript, maxChars: number): string {
  const text = transcript.cues.map((c) => c.text).join(' ');
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}
