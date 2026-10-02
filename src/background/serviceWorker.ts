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
  pausePlayback,
  presentQuiz,
  releaseLock,
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
        console.log('[brb] lock released');
        await releaseLock();
        break;

      case 'pausePlayback':
        await pausePlayback();
        break;

      case 'presentQuiz':
      case 'presentRemediation':
        await presentQuiz();
        break;

      case 'startGeneration':
        // Phase 5 fills this in. Until then the challenge surface shows a
        // placeholder, which is enough to exercise every lock transition.
        console.log('[brb] generation requested for', effect.videoId, `(${effect.reason})`);
        break;

      case 'reportFault':
        // Fail open, loudly. This is the branch that stops a broken challenge
        // screen from turning into a locked computer.
        console.error('[brb] fault, unlocking:', effect.reason);
        await releaseLock();
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

/* ------------------------------------------------------------------ *
 * Provider events
 * ------------------------------------------------------------------ */

/**
 * Duration is needed to work out the per-video threshold, but it arrives on a
 * separate event from the progress ticks that use it. Storing it per video
 * keeps the state machine pure and free of lookups.
 */
const durations = new Map<string, number>();

async function handleProviderEvent(event: ProviderEvent): Promise<void> {
  if (event.type === 'metadataUpdated' || event.type === 'videoStarted') {
    const { videoId, durationSeconds } = event.metadata;
    if (durationSeconds) durations.set(videoId, durationSeconds);
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
  | { kind: 'quizPassed' }
  | { kind: 'quizFailed' }
  | { kind: 'remediationPassed' }
  | { kind: 'remediationFailed' }
  | { kind: 'parentSkip' }
  | { kind: 'parentTimedUnlock' }
  | { kind: 'parentDisableUntilRestart' }
  | { kind: 'parentHasPin' }
  | { kind: 'parentSetPin'; pin: string }
  | { kind: 'parentVerifyPin'; pin: string }
  | { kind: 'parentEndSession' }
  | { kind: 'getState' }
  | { kind: 'clearLock' }
  | { kind: 'clearDiagnostics' };

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
    case 'quizPassed':
      return reply(dispatch({ type: 'quizPassed' }));
    case 'quizFailed':
      return reply(dispatch({ type: 'quizFailed' }));
    case 'remediationPassed':
      return reply(dispatch({ type: 'remediationPassed' }));
    case 'remediationFailed':
      return reply(dispatch({ type: 'remediationFailed' }));
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
      // The recovery control. Behind the PIN once one is set, open before
      // that. A parent who forgets the PIN can still remove and reinstall the
      // extension, which clears storage and with it the lock.
      return reply(requireSession(() => resetState().then(() => releaseLock())));
    case 'clearDiagnostics':
      return reply(chrome.storage.local.remove('diagnostics.v1'));
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
