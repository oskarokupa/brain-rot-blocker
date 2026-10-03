/**
 * Service worker entry point.
 *
 * It owns nothing. The state machine decides, the store persists, the enforcer
 * acts, and this file is the wiring between them plus the browser lifecycle.
 *
 * MV3 workers are killed after roughly 30 seconds idle, so module scope holds
 * no durable state. Anything that matters is read back from storage on every
 * wake, which is also what makes a crash indistinguishable from an idle
 * timeout as far as the lock is concerned.
 */

import { CONFIG } from '../config.js';
import {
  attachLockListeners,
  forceReturnToYoutubeKids,
  pausePlayback,
  presentQuiz,
  sweepAllTabs,
} from '../core/lock.js';
import { dispatch, readState, resetState, setEffectRunner } from '../core/store.js';
import type { Effect } from '../core/stateMachine.js';
import { isLocked } from '../core/types.js';
import {
  endSession,
  hasPin,
  hasValidSession,
  isValidPinFormat,
  setPin,
  verifyPin,
} from '../parent/pin.js';
import type { ProviderEvent } from '../providers/types.js';
import { transcriptToText } from '../providers/transcriptUtil.js';
import { apiKeyHint, hasApiKey, setApiKey } from '../quiz/llm/apiKeyStore.js';
import type { AnswerResponse } from '../quiz/schema.js';
import {
  discardCurrentQuestion,
  getActiveQuestion,
  startMainQuiz,
  startRemediationRound,
  submitAnswer as submitQuizAnswer,
} from '../quiz/quizStore.js';
import { recordDiagnostic, type VideoDiagnostic } from './diagnostics.js';

const TICK_ALARM = 'brb-tick';

/* ------------------------------------------------------------------ *
 * Effects
 * ------------------------------------------------------------------ */

setEffectRunner(async (effects: Effect[]) => {
  for (const effect of effects) {
    switch (effect.type) {
      case 'engageLock':
        console.log('[brb] lock engaged');
        await sweepAllTabs();
        break;

      case 'releaseLock':
        console.log('[brb] lock released', effect.silent ? '(screen in progress)' : '(forced)');
        // Silent releases trust whatever is already on screen — a success
        // screen, or a parent panel that is about to navigate itself — to
        // leave on its own. Everything else gets moved immediately, since
        // nothing in those cases can be trusted to do it.
        if (!effect.silent) await forceReturnToYoutubeKids();
        break;

      case 'pausePlayback':
        await pausePlayback();
        break;

      case 'presentQuiz':
        await presentQuiz();
        break;

      case 'presentRemediation':
        // The round's questions have to exist before the tab opens, since the
        // UI asks for them the moment it loads.
        await startRemediationRound(effect.round);
        await presentQuiz();
        break;

      case 'startGeneration':
        await startMainQuiz(effect.videoId, durations.get(effect.videoId) ?? null, {
          transcriptText: await waitForTranscript(effect.videoId),
          metadata: metadataCache.get(effect.videoId) ?? null,
        });
        break;

      case 'reportFault':
        // Fail open, loudly, and immediately. This is the branch that stops a
        // broken challenge screen from turning into a locked computer, so it
        // cannot wait on that same screen to navigate itself anywhere.
        console.error('[brb] fault, unlocking:', effect.reason);
        await forceReturnToYoutubeKids();
        break;
    }
  }
});

/* ------------------------------------------------------------------ *
 * Lock enforcement
 * ------------------------------------------------------------------ */

attachLockListeners(async () => {
  const state = await readState(Date.now());
  return isLocked(state, Date.now());
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generation starts the moment the watch threshold crosses, which on a short
 * video can arrive before the caption fetch has landed at all - the threshold
 * is seconds of watching, the caption request is a network round trip, and
 * nothing ties the two together otherwise. This waits briefly for the
 * transcript to reach the configured coverage before giving up and letting
 * generation proceed with whatever is cached, including nothing at all.
 *
 * This happens in the quizPreparing phase, before anything is locked, so a
 * few seconds of extra wait here costs nothing she can feel - she is still
 * watching the video it is about.
 */
const TRANSCRIPT_WAIT_TIMEOUT_MS = 5000;
const TRANSCRIPT_WAIT_POLL_MS = 250;

async function waitForTranscript(videoId: string): Promise<string | null> {
  const deadline = Date.now() + TRANSCRIPT_WAIT_TIMEOUT_MS;
  for (;;) {
    const cached = transcriptCache.get(videoId);
    if (cached && cached.coverage >= CONFIG.llm.generateAtTranscriptFraction) return cached.text;
    if (Date.now() >= deadline) return cached?.text ?? null;
    await sleep(TRANSCRIPT_WAIT_POLL_MS);
  }
}

/* ------------------------------------------------------------------ *
 * Provider events
 * ------------------------------------------------------------------ */

/**
 * Duration, metadata and the transcript all arrive on separate events from
 * the ones that need them later, and are per-video state the state machine
 * itself must stay free of (it is pure, provider-independent, and video
 * content is a quiz concern, not a lock concern). Caching them here, in the
 * worker's own module scope, is also what keeps the privacy design honest:
 * "transcripts live in memory" from the SOP means exactly this, not storage -
 * there is no durable record of what a video was actually about, only of the
 * questions that got asked.
 *
 * Module scope does not survive a worker restart, which is fine: if the
 * worker dies mid-video, startGeneration fires again from a later progress
 * event with no cache entry yet, and generateQuiz's metadata/bank tiers below
 * transcript cover exactly that gap.
 */
const durations = new Map<string, number>();
const metadataCache = new Map<string, { title: string | null; channel: string | null; description: string | null }>();
const transcriptCache = new Map<string, { text: string; coverage: number }>();

async function handleProviderEvent(event: ProviderEvent): Promise<void> {
  if (event.type === 'metadataUpdated' || event.type === 'videoStarted') {
    const { videoId, durationSeconds, title, channel, description } = event.metadata;
    if (durationSeconds) durations.set(videoId, durationSeconds);
    if (title || description) metadataCache.set(videoId, { title, channel, description });
  }

  if (event.type === 'transcriptUpdated') {
    const { videoId, coverage } = event.transcript;
    transcriptCache.set(videoId, {
      text: transcriptToText(event.transcript, CONFIG.llm.maxTranscriptChars),
      coverage,
    });
  }

  const videoId =
    'videoId' in event
      ? event.videoId
      : 'metadata' in event
        ? event.metadata.videoId
        : event.transcript.videoId;

  await dispatch({
    type: 'provider',
    event,
    durationSeconds: durations.get(videoId) ?? null,
  });

  await recordDiagnostic(event);
}

/* ------------------------------------------------------------------ *
 * Messages
 * ------------------------------------------------------------------ */

type Message =
  | { kind: 'providerEvent'; event: ProviderEvent }
  | { kind: 'quizReady' }
  | { kind: 'quizRenderFailed'; reason: string }
  | { kind: 'quizGetQuestion' }
  | { kind: 'quizSubmitAnswer'; response: AnswerResponse }
  | { kind: 'quizDiscard' }
  | { kind: 'parentSkip' }
  | { kind: 'parentTimedUnlock' }
  | { kind: 'parentDisableUntilRestart' }
  | { kind: 'parentHasPin' }
  | { kind: 'parentSetPin'; pin: string }
  | { kind: 'parentVerifyPin'; pin: string }
  | { kind: 'parentEndSession' }
  | { kind: 'getState' }
  | { kind: 'clearLock' }
  | { kind: 'clearDiagnostics' }
  | { kind: 'parentGetApiKeyStatus' }
  | { kind: 'parentSetApiKey'; key: string };

/**
 * Parent actions all sit behind a verified PIN session. An extension with no
 * PIN configured passes this freely, because shutting a parent out of their
 * own controls would be a worse failure than an open one.
 */
async function requireSession<T>(work: () => Promise<T>): Promise<T | { denied: true }> {
  if (!(await hasValidSession())) return { denied: true };
  return work();
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  const reply = (work: Promise<unknown>) => {
    work
      .then((value) => sendResponse({ ok: true, value }))
      .catch((err) => {
        console.error('[brb] message failed', message.kind, err);
        sendResponse({ ok: false });
      });
    return true;
  };

  switch (message.kind) {
    case 'providerEvent':
      return reply(handleProviderEvent(message.event));
    case 'quizReady':
      return reply(dispatch({ type: 'quizRendered' }));
    case 'quizRenderFailed':
      return reply(dispatch({ type: 'quizRenderFailed', reason: message.reason }));
    case 'quizGetQuestion':
      return reply(getActiveQuestion());
    case 'quizSubmitAnswer':
      // Grading, scoring and the pass/fail dispatch to the lock state machine
      // all happen inside submitQuizAnswer. The UI only ever sees the result,
      // never a chance to report its own pass or fail.
      return reply(submitQuizAnswer(message.response));
    case 'quizDiscard':
      return reply(discardCurrentQuestion());
    case 'parentSkip':
      return reply(requireSession(() => dispatch({ type: 'parentSkip' })));
    case 'parentTimedUnlock':
      return reply(requireSession(() => dispatch({ type: 'parentTimedUnlock' })));
    case 'parentDisableUntilRestart':
      return reply(requireSession(() => dispatch({ type: 'parentDisableUntilRestart' })));
    case 'parentHasPin':
      return reply(hasPin());
    case 'parentSetPin':
      // Changing an existing PIN needs the current one first. Setting the
      // first PIN does not, because there is nothing to authorise against.
      return reply(
        hasPin().then(async (exists) => {
          if (exists && !(await hasValidSession())) return { denied: true };
          if (!isValidPinFormat(message.pin)) return { invalid: true };
          return { ok: await setPin(message.pin) };
        }),
      );
    case 'parentVerifyPin':
      return reply(verifyPin(message.pin));
    case 'parentEndSession':
      return reply(endSession());
    case 'getState':
      return reply(readState(Date.now()));
    case 'clearLock':
      // The recovery control, used precisely when the challenge screen cannot
      // be trusted. resetState bypasses the state machine's own effects
      // entirely, so this calls the forced path directly rather than the
      // generic releaseLock, which would otherwise do nothing here. Behind
      // the PIN once one is set, open before that: a parent who forgets the
      // PIN can still remove and reinstall the extension, which clears
      // storage and with it the lock, so refusing this outright would not
      // add real protection, only an extra step.
      return reply(requireSession(() => resetState().then(() => forceReturnToYoutubeKids())));
    case 'clearDiagnostics':
      return reply(chrome.storage.local.remove('diagnostics.v1'));
    case 'parentGetApiKeyStatus':
      // The key itself never leaves the worker, only whether one is set and
      // a masked hint, the same spirit as the PIN never being shown back.
      return reply(Promise.all([hasApiKey(), apiKeyHint()]).then(([set, hint]) => ({ set, hint })));
    case 'parentSetApiKey':
      return reply(requireSession(() => setApiKey(message.key)));
    default:
      return false;
  }
});

/* ------------------------------------------------------------------ *
 * Lifecycle
 *
 * Three entry points, one recovery path. onStartup covers a profile launch,
 * onInstalled covers an extension reload or update, and the module body itself
 * covers every ordinary wake. Relying on onStartup alone would miss a reload
 * performed mid-challenge.
 * ------------------------------------------------------------------ */

async function recover(trigger: string): Promise<void> {
  const state = await readState(Date.now());
  console.log('[brb] recover via', trigger, 'phase:', state.phase);
  await dispatch({ type: 'recover' });
}

chrome.runtime.onStartup.addListener(() => void recover('onStartup'));
chrome.runtime.onInstalled.addListener(() => void recover('onInstalled'));

chrome.alarms.create(TICK_ALARM, { periodInMinutes: CONFIG.lock.sweepAlarmMinutes });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TICK_ALARM) return;
  // Drives the render watchdog and notices a timed unlock running out. The
  // worker cannot hold a timer of its own across a sleep, so the alarm is how
  // time passes as far as the state machine is concerned.
  void dispatch({ type: 'tick' });
});

void recover('workerStart');

console.log('[brb] service worker ready');

export type { VideoDiagnostic };
