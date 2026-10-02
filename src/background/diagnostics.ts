/**
 * Capture diagnostics, kept from phase 1.
 *
 * This records what the provider managed to extract per video, so transcript
 * availability can be measured against real viewing rather than guessed. It is
 * separate from the lock state on purpose: it is observational, it is allowed
 * to be lossy, and nothing in the state machine reads it.
 */

import type { ProviderEvent } from '../providers/types.js';

const DIAG_KEY = 'diagnostics.v1';
const MAX_VIDEOS = 40;

export interface VideoDiagnostic {
  videoId: string;
  title: string | null;
  durationSeconds: number | null;
  firstSeenIso: string;
  transcriptCaptured: boolean;
  transcriptLanguage: string | null;
  transcriptIsAutomatic: boolean | null;
  cueCount: number;
  coverage: number;
  unavailableReason: string | null;
  ended: boolean;
}

type DiagnosticStore = Record<string, VideoDiagnostic>;

/** Its own queue. Diagnostics must never delay or interleave with lock state. */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

function blank(videoId: string): VideoDiagnostic {
  return {
    videoId,
    title: null,
    durationSeconds: null,
    firstSeenIso: new Date().toISOString(),
    transcriptCaptured: false,
    transcriptLanguage: null,
    transcriptIsAutomatic: null,
    cueCount: 0,
    coverage: 0,
    unavailableReason: null,
    ended: false,
  };
}

function update(videoId: string, mutate: (entry: VideoDiagnostic) => void): Promise<void> {
  return serialize(async () => {
    const stored = await chrome.storage.local.get(DIAG_KEY);
    const store = (stored[DIAG_KEY] as DiagnosticStore) ?? {};
    const entry = store[videoId] ?? blank(videoId);
    mutate(entry);
    store[videoId] = entry;

    const ordered = Object.values(store).sort((a, b) =>
      a.firstSeenIso.localeCompare(b.firstSeenIso),
    );
    const trimmed: DiagnosticStore = {};
    for (const item of ordered.slice(-MAX_VIDEOS)) trimmed[item.videoId] = item;

    await chrome.storage.local.set({ [DIAG_KEY]: trimmed });
  });
}

export async function recordDiagnostic(event: ProviderEvent): Promise<void> {
  switch (event.type) {
    case 'videoStarted':
    case 'metadataUpdated':
      await update(event.metadata.videoId, (entry) => {
        entry.title = event.metadata.title ?? entry.title;
        entry.durationSeconds = event.metadata.durationSeconds ?? entry.durationSeconds;
      });
      break;

    case 'transcriptUpdated':
      await update(event.transcript.videoId, (entry) => {
        entry.transcriptCaptured = true;
        entry.transcriptLanguage = event.transcript.languageCode;
        entry.transcriptIsAutomatic = event.transcript.isAutomatic;
        entry.cueCount = event.transcript.cues.length;
        entry.coverage = event.transcript.coverage;
        entry.unavailableReason = null;
      });
      break;

    case 'transcriptUnavailable':
      await update(event.videoId, (entry) => {
        if (!entry.transcriptCaptured) entry.unavailableReason = event.reason;
      });
      break;

    case 'videoEnded':
      await update(event.videoId, (entry) => {
        entry.ended = true;
      });
      break;

    case 'progress':
    case 'videoLeft':
      break;
  }
}
