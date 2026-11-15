/**
 * YouTube Kids provider. Runs in the ISOLATED world as a content script.
 *
 * This is the only module allowed to know how YouTube Kids is built. It turns
 * page specifics into the normalized events in ../types.ts and sends them to
 * the service worker.
 *
 * Trust boundary: the MAIN world hook is page context, so anything it posts is
 * treated as untrusted until the nonce matches the first hello we saw.
 */

import { CONFIG } from '../../config.js';
import type { ProviderEvent, ProviderEventHandler, VideoMetadata } from '../types.js';
import { buildTranscript } from './transcript.js';

const HOOK_SOURCE = 'brb-hook';

let latchedNonce: string | null = null;

/** Per-video state, reset on navigation. */
let currentVideoId: string | null = null;
let metadata: VideoMetadata | null = null;
let captionKinds = new Map<string, boolean>();
let emit: ProviderEventHandler = () => undefined;

function videoIdFromUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

function blankMetadata(videoId: string): VideoMetadata {
  return { videoId, title: null, durationSeconds: null, channel: null, description: null };
}

/* ------------------------------------------------------------------ *
 * Messages from the MAIN world hook
 * ------------------------------------------------------------------ */

function onHookMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== HOOK_SOURCE || typeof data.nonce !== 'string') return;

  // Trust on first use. The hook runs at document_start before any page
  // script, so the first hello is genuinely ours. Anything with a different
  // nonce afterwards is forged and gets dropped.
  if (latchedNonce === null) {
    if (data.payload?.kind !== 'hello') return;
    latchedNonce = data.nonce;
    return;
  }
  if (data.nonce !== latchedNonce) return;

  handlePayload(data.payload);
}

function handlePayload(payload: any): void {
  switch (payload?.kind) {
    case 'playerResponse': {
      const raw = payload.raw;
      metadata = {
        videoId: raw.videoId,
        title: raw.title ?? null,
        durationSeconds: raw.lengthSeconds ?? null,
        channel: raw.channel ?? null,
        description: raw.description ?? null,
      };
      captionKinds = new Map(
        (raw.captionTracks ?? []).map((t: any) => [t.languageCode, t.kind === 'asr']),
      );
      emit({ type: 'metadataUpdated', metadata });
      break;
    }

    case 'timedtext': {
      const videoId = payload.videoId ?? currentVideoId;
      if (!videoId) return;
      const language = payload.languageCode ?? 'en';
      const transcript = buildTranscript(
        videoId,
        language,
        captionKinds.get(language) ?? true,
        payload.body,
        metadata?.durationSeconds ?? null,
      );
      if (transcript) emit({ type: 'transcriptUpdated', transcript });
      else emit({ type: 'transcriptUnavailable', videoId, reason: 'empty or unparsable captions' });
      break;
    }

    case 'captionsUnavailable': {
      emit({ type: 'transcriptUnavailable', videoId: payload.videoId, reason: payload.reason });
      break;
    }

    default:
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Playback observation
 *
 * Deliberately independent of the MAIN world hook. If YouTube breaks caption
 * interception, transcripts degrade but video end detection keeps working, so
 * the lock still triggers.
 * ------------------------------------------------------------------ */

let videoEl: HTMLVideoElement | null = null;
let lastPosition = 0;

function findMainVideo(): HTMLVideoElement | null {
  // Scope to the player. YouTube surfaces preview and thumbnail video elements
  // elsewhere in the page, and binding to one of those would report the wrong
  // playback position.
  return (
    document.querySelector<HTMLVideoElement>('#movie_player video.html5-main-video') ??
    document.querySelector<HTMLVideoElement>('.html5-main-video') ??
    document.querySelector<HTMLVideoElement>('#movie_player video')
  );
}

function attachToVideoElement(): void {
  const el = findMainVideo();
  if (!el || el === videoEl) return;
  videoEl = el;
  lastPosition = 0;

  el.addEventListener('ended', () => {
    if (currentVideoId) emit({ type: 'videoEnded', videoId: currentVideoId });
  });

  el.addEventListener('timeupdate', () => {
    if (!currentVideoId) return;
    const position = el.currentTime;
    // Guard against seeking being counted as watching.
    const jumped = Math.abs(position - lastPosition) > CONFIG.watch.seekToleranceSeconds;
    lastPosition = position;
    if (jumped) return;
    emit({
      type: 'progress',
      videoId: currentVideoId,
      positionSeconds: position,
      playing: !el.paused,
    });
  });

  // Some endings do not fire "ended" reliably on the SPA player, so treat
  // arriving within a second of the duration as an ending too.
  el.addEventListener('pause', () => {
    if (!currentVideoId || !el.duration) return;
    if (el.duration - el.currentTime <= 1) emit({ type: 'videoEnded', videoId: currentVideoId });
  });
}

/* ------------------------------------------------------------------ *
 * SPA navigation
 * ------------------------------------------------------------------ */

function onLocationChanged(): void {
  const next = videoIdFromUrl(window.location.href);
  if (next === currentVideoId) return;

  const previous = currentVideoId;
  if (previous) emit({ type: 'videoLeft', videoId: previous, nextVideoId: next });

  currentVideoId = next;
  metadata = next ? blankMetadata(next) : null;
  captionKinds = new Map();

  if (next && metadata) {
    emit({ type: 'videoStarted', metadata, atSeconds: 0 });
  }
  attachToVideoElement();
}

function watchForNavigation(): void {
  let lastHref = window.location.href;
  const check = () => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      onLocationChanged();
    }
    attachToVideoElement();
  };
  // YouTube Kids is a Polymer SPA that swaps the player without a page load,
  // so poll the URL rather than relying on history events the app may not fire.
  setInterval(check, 500);
  window.addEventListener('popstate', check);
  window.addEventListener('yt-navigate-finish', check);

  // A refresh or a closed tab is leaving the video as much as an in-app
  // navigation is, but none of the checks above ever see it: the page is gone
  // before the next poll. Without this the worker never hears about the leave
  // and an owed challenge waits on an ending that cannot arrive.
  window.addEventListener('pagehide', () => {
    if (currentVideoId) emit({ type: 'videoLeft', videoId: currentVideoId, nextVideoId: null });
  });
}

/* ------------------------------------------------------------------ *
 * Wiring to the service worker
 * ------------------------------------------------------------------ */

function sendToWorker(event: ProviderEvent): void {
  try {
    // When the extension is reloaded (a normal part of development, or a
    // Chrome update), a content script already injected into an open tab is
    // left holding a dead reference: chrome.runtime.sendMessage throws
    // synchronously here, before it ever returns a promise, so a plain
    // .catch() on the result never attaches and this becomes an uncaught
    // error instead of the harmless dropped event it actually is. The page
    // only gets a working copy again once it is reloaded, which is expected
    // and not something this script can fix for itself.
    chrome.runtime.sendMessage({ kind: 'providerEvent', providerId: 'youtubeKids', event }).catch(() => {
      // The worker may be asleep or the extension reloading. State lives in
      // storage, so a dropped progress tick is not worth retrying.
    });
  } catch {
    // Extension context invalidated. Nothing to do until the page reloads.
  }
}

/**
 * The worker asks for playback to stop the moment a challenge is owed, so the
 * next video cannot start playing behind the challenge screen.
 */
function listenForWorkerRequests(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.kind === 'pausePlayback') {
      const el = findMainVideo();
      try {
        el?.pause();
      } catch {
        // Nothing useful to do. The lock does not depend on this succeeding.
      }
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });
}

function startProvider(): void {
  emit = sendToWorker;
  window.addEventListener('message', onHookMessage);
  listenForWorkerRequests();
  watchForNavigation();
  onLocationChanged();
}

startProvider();
