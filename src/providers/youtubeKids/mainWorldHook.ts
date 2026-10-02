/**
 * MAIN world hook for YouTube Kids.
 *
 * This is the only code that runs in the page's own JavaScript context, and it
 * exists for two reasons that nothing in the ISOLATED world can do:
 *
 *  1. Patch XMLHttpRequest and fetch so we can read the player's own network
 *     traffic.
 *  2. Call the player's API to turn captions on.
 *
 * Why this indirection at all: the signed caption URL inside the player
 * response returns HTTP 200 with an empty body. Measured against YouTube on
 * 2026-09-27, every /api/timedtext URL lacking a "pot" proof-of-origin
 * parameter came back with zero bytes, while the request the player issued
 * itself carried "pot" and returned 17,857 bytes. We cannot mint that token,
 * so we ask the player to fetch its own captions and read the answer.
 *
 * Everything here is untrusted from the core's point of view. The ISOLATED
 * provider validates the nonce before believing any of it.
 */

const HOOK_SOURCE = 'brb-hook';

/**
 * Trust on first use. This script runs at document_start in the MAIN world,
 * which is before any page script, so the first hello on the wire is ours.
 * The provider latches this value and rejects later messages carrying anything
 * else, which stops page or console code forging transcripts or end events.
 */
const NONCE = crypto.randomUUID();

type HookPayload =
  | { kind: 'hello' }
  | { kind: 'playerResponse'; videoId: string; raw: PlayerResponseSummary }
  | { kind: 'timedtext'; videoId: string | null; languageCode: string | null; body: string }
  | { kind: 'captionsUnavailable'; videoId: string; reason: string }
  | { kind: 'playerReady'; videoId: string | null };

interface PlayerResponseSummary {
  videoId: string | null;
  title: string | null;
  lengthSeconds: number | null;
  channel: string | null;
  description: string | null;
  captionTracks: Array<{ languageCode: string; kind: string; name: string | null }>;
}

function post(payload: HookPayload): void {
  window.postMessage({ source: HOOK_SOURCE, nonce: NONCE, payload }, window.location.origin);
}

// Announce ourselves immediately so the provider can latch the nonce.
post({ kind: 'hello' });

/* ------------------------------------------------------------------ *
 * Network interception
 * ------------------------------------------------------------------ */

function summarisePlayerResponse(json: any): PlayerResponseSummary | null {
  const details = json?.videoDetails;
  if (!details && !json?.captions) return null;
  const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  return {
    videoId: details?.videoId ?? null,
    title: details?.title ?? null,
    lengthSeconds: details?.lengthSeconds ? Number(details.lengthSeconds) : null,
    channel: details?.author ?? null,
    description: details?.shortDescription ?? null,
    captionTracks: tracks.map((t: any) => ({
      languageCode: t?.languageCode ?? '',
      kind: t?.kind ?? 'manual',
      name: t?.name?.simpleText ?? t?.name?.runs?.[0]?.text ?? null,
    })),
  };
}

function handleCapturedBody(url: string, body: string): void {
  try {
    if (url.includes('/api/timedtext')) {
      const parsed = new URL(url, window.location.origin);
      const videoId = parsed.searchParams.get('v');
      // An empty body is the signature of a caption URL without a valid
      // proof-of-origin token. Treat it as not captured so the retry loop
      // gets another go rather than reporting a transcript we do not have.
      if (body.length === 0) return;
      if (videoId) capturedFor.add(videoId);
      post({
        kind: 'timedtext',
        videoId,
        languageCode: parsed.searchParams.get('lang'),
        body,
      });
      return;
    }
    if (url.includes('/youtubei/v1/player')) {
      const summary = summarisePlayerResponse(JSON.parse(body));
      if (summary?.videoId) {
        post({ kind: 'playerResponse', videoId: summary.videoId, raw: summary });
        if (summary.captionTracks.length === 0) {
          post({
            kind: 'captionsUnavailable',
            videoId: summary.videoId,
            reason: 'no caption tracks in player response',
          });
        }
      }
    }
  } catch {
    // A malformed body is not worth breaking the page over. The core treats
    // missing transcripts as an ordinary outcome, not an error.
  }
}

function isInteresting(url: string): boolean {
  return url.includes('/api/timedtext') || url.includes('/youtubei/v1/player');
}

function patchXhr(): void {
  // Typed loosely on purpose: open() is overloaded and we only care about
  // recording the URL before handing the call straight through untouched.
  const open = XMLHttpRequest.prototype.open as (...args: any[]) => void;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (this: any, ...args: any[]) {
    const url = args[1];
    this.__brbUrl = typeof url === 'string' ? url : String(url);
    return open.apply(this, args);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function (this: any, ...args: any[]) {
    const url: string | undefined = this.__brbUrl;
    if (url && isInteresting(url)) {
      this.addEventListener('load', () => {
        try {
          if (typeof this.responseText === 'string' && this.responseText.length > 0) {
            handleCapturedBody(url, this.responseText);
          }
        } catch {
          // responseText throws for some responseTypes. Nothing to do.
        }
      });
    }
    return send.apply(this, args as []);
  };
}

function patchFetch(): void {
  const original = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const input = args[0];
    const url =
      typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const response = await original.apply(this, args);
    if (isInteresting(url)) {
      response
        .clone()
        .text()
        .then((body) => handleCapturedBody(url, body))
        .catch(() => undefined);
    }
    return response;
  };
}

patchXhr();
patchFetch();

/* ------------------------------------------------------------------ *
 * Player control
 * ------------------------------------------------------------------ */

interface YouTubePlayer extends HTMLElement {
  loadModule?: (name: string) => void;
  getOption?: (module: string, option: string) => unknown;
  setOption?: (module: string, option: string, value: unknown) => void;
  getVideoData?: () => { video_id?: string };
}

function findPlayer(): YouTubePlayer | null {
  const direct = document.querySelector<YouTubePlayer>('#movie_player, .html5-video-player');
  if (direct?.setOption) return direct;
  // YouTube Kids has renamed the player container before. Fall back to any
  // element exposing the player API rather than pinning a single selector.
  for (const el of Array.from(document.querySelectorAll<YouTubePlayer>('*'))) {
    if (typeof el.setOption === 'function' && typeof el.loadModule === 'function') return el;
  }
  return null;
}

/**
 * Captions have to be switched on for the player to fetch them, which would
 * put subtitles on screen. Hiding the caption container keeps her viewing
 * experience unchanged.
 */
function hideCaptionDisplay(): void {
  const id = 'brb-caption-hide';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .ytp-caption-window-container,
    .caption-window,
    .ytp-caption-segment { opacity: 0 !important; visibility: hidden !important; }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

/** Videos whose captions we have actually received, not merely asked for. */
const capturedFor = new Set<string>();
/** Attempts made per video, so a video that will never yield gives up. */
const attemptsFor = new Map<string, number>();

const MAX_CAPTION_ATTEMPTS = 15;

function currentVideoId(player: YouTubePlayer): string | null {
  try {
    return player.getVideoData?.().video_id ?? null;
  } catch {
    return null;
  }
}

function requestCaptions(player: YouTubePlayer): void {
  const videoId = currentVideoId(player);
  // No video data yet means the player is still starting up. Not a failure,
  // so do not spend an attempt on it.
  if (!videoId) return;
  if (capturedFor.has(videoId)) return;

  const attempts = attemptsFor.get(videoId) ?? 0;
  if (attempts >= MAX_CAPTION_ATTEMPTS) return;

  try {
    hideCaptionDisplay();
    player.loadModule?.('captions');
    const tracks = player.getOption?.('captions', 'tracklist') as
      | Array<{ languageCode?: string; kind?: string }>
      | undefined;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      // The tracklist is not populated the instant the module loads, so an
      // empty list this early proves nothing. Spend an attempt and retry.
      attemptsFor.set(videoId, attempts + 1);
      if (attempts + 1 >= MAX_CAPTION_ATTEMPTS) {
        post({ kind: 'captionsUnavailable', videoId, reason: 'no caption tracks offered' });
      }
      return;
    }

    attemptsFor.set(videoId, attempts + 1);
    const preferred =
      tracks.find((t) => t.languageCode === 'en' && t.kind !== 'asr') ??
      tracks.find((t) => t.languageCode === 'en') ??
      tracks[0];

    if (!preferred) {
      post({ kind: 'captionsUnavailable', videoId, reason: 'empty tracklist' });
      return;
    }
    // Re-issued on each attempt until a body actually arrives, because the
    // player silently ignores this while it is still buffering.
    player.setOption?.('captions', 'track', { languageCode: preferred.languageCode });
  } catch (err) {
    attemptsFor.set(videoId, attempts + 1);
    post({ kind: 'captionsUnavailable', videoId, reason: `player api: ${String(err)}` });
  }
}

let announcedPlayer = false;

function tick(): void {
  const player = findPlayer();
  if (!player) return;
  if (!announcedPlayer) {
    announcedPlayer = true;
    post({ kind: 'playerReady', videoId: currentVideoId(player) });
  }
  requestCaptions(player);
}

// The player mounts well after document_start and remounts on SPA navigation,
// so poll rather than wait on a single readiness event.
setInterval(tick, 1000);
document.addEventListener('DOMContentLoaded', tick);
