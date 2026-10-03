/**
 * The state machine. Pure functions only.
 *
 * No chrome.* calls, no DOM, no clock of its own. Everything it needs arrives
 * as arguments and everything it wants done leaves as an effect for the caller
 * to carry out. That is what makes the lock behaviour testable without a
 * browser, which matters more here than anywhere else in the extension.
 */

import { CONFIG, watchThresholdForDuration } from '../config.js';
import type { ProviderEvent } from '../providers/types.js';
import type { PersistedState, Phase } from './types.js';
import { isLocked } from './types.js';

const WATCHDOG_MS = CONFIG.lock.renderWatchdogMs;

export type CoreEvent =
  | { type: 'provider'; event: ProviderEvent; durationSeconds: number | null }
  /** The quiz surface rendered successfully. */
  | { type: 'quizRendered' }
  /** The quiz surface failed to render, or never reported in. */
  | { type: 'quizRenderFailed'; reason: string }
  | { type: 'quizPassed' }
  | { type: 'quizFailed' }
  | { type: 'remediationPassed' }
  | { type: 'remediationFailed' }
  | { type: 'parentSkip' }
  | { type: 'parentTimedUnlock' }
  | { type: 'parentDisableUntilRestart' }
  /** Worker woke, profile started, or the extension reloaded. */
  | { type: 'recover' }
  /** Periodic re-check, used to notice a timed unlock expiring. */
  | { type: 'tick' };

export type Effect =
  | { type: 'engageLock' }
  /**
   * `silent: true` means a result screen is already on its own way to showing
   * her (or the parent panel driving this release is about to navigate
   * itself), so the caller must not force the tab anywhere. `false` means
   * nothing on screen can be trusted to leave on its own, and the caller
   * should return the tab to YouTube Kids immediately.
   */
  | { type: 'releaseLock'; silent: boolean }
  | { type: 'pausePlayback' }
  /** Begin building a challenge for this video. */
  | { type: 'startGeneration'; videoId: string; reason: 'videoThreshold' | 'carryOver' }
  /** Open the challenge surface and start the render watchdog. */
  | { type: 'presentQuiz'; videoId: string | null }
  | { type: 'presentRemediation'; round: number }
  /** Something internal broke. Unlock and record why. */
  | { type: 'reportFault'; reason: string };

export interface Transition {
  state: PersistedState;
  effects: Effect[];
}

/* ------------------------------------------------------------------ *
 * Watch accounting
 * ------------------------------------------------------------------ */

/**
 * Elapsed watching between two reported positions. A jump larger than the
 * tolerance is seeking, not watching, and earns nothing. Going backwards
 * earns nothing either.
 */
function elapsedBetween(previous: number, next: number): number {
  const delta = next - previous;
  if (delta <= 0) return 0;
  if (delta > CONFIG.watch.seekToleranceSeconds) return 0;
  return delta;
}

/**
 * Whether the accumulated watching now obliges a challenge, and on what basis.
 * The per-video rule catches ordinary viewing. The carry-over budget catches
 * the child who watches just under the threshold and skips, repeatedly.
 */
function obligationReason(
  state: PersistedState,
  durationSeconds: number | null,
): 'videoThreshold' | 'carryOver' | null {
  const threshold = watchThresholdForDuration(durationSeconds ?? Infinity);
  if (state.activeWatchedSeconds >= threshold) return 'videoThreshold';
  if (state.carryOverSeconds + state.activeWatchedSeconds >= CONFIG.watch.carryOverBudgetSeconds) {
    return 'carryOver';
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */

function withPhase(state: PersistedState, phase: Phase, now: number): PersistedState {
  return { ...state, phase, lastTransitionAt: now };
}

/** Clears the obligation and every trace of the challenge that satisfied it. */
function cleared(state: PersistedState, now: number): PersistedState {
  return {
    ...state,
    phase: 'idle',
    owedVideoId: null,
    owedReason: null,
    remediationRound: 0,
    renderDeadlineAt: null,
    activeWatchedSeconds: 0,
    carryOverSeconds: 0,
    lastTransitionAt: now,
  };
}

export function reduce(state: PersistedState, event: CoreEvent, now: number): Transition {
  const effects: Effect[] = [];

  let next = applyEvent(state, event, now, effects);

  // A timed unlock that has run out drops back to the challenge it suspended,
  // before the lock is derived, so expiry and enforcement cannot disagree.
  if (next.phase === 'parentUnlocked' && isLocked(next, now)) {
    next = { ...next, phase: next.remediationRound > 0 ? 'remediationLocked' : 'quizLocked' };
  }

  // Derived from the phase, never set by hand, and compared against what the
  // enforcer was last told rather than against a second reading of the clock.
  // An unlock that expired while nothing was running would otherwise read as
  // already locked, and the enforcer would never be asked to engage.
  const shouldLock = isLocked(next, now);
  if (shouldLock !== next.lockEngaged) {
    if (shouldLock) {
      effects.unshift({ type: 'engageLock' });
    } else {
      // A success screen is only in flight for a genuine pass, including the
      // final remediation round clearing regardless of its own score. Every
      // other release — a parent action, or a fault with no reliable UI to
      // show anything — gets the tab moved immediately rather than trusting
      // a page that may not be there, or may not be the one doing the asking.
      const silent =
        (event.type === 'quizPassed' ||
          event.type === 'remediationPassed' ||
          event.type === 'remediationFailed') &&
        next.phase === 'idle';
      effects.push({ type: 'releaseLock', silent });
    }
    next = { ...next, lockEngaged: shouldLock };
  }

  return { state: next, effects };
}

function applyEvent(
  state: PersistedState,
  event: CoreEvent,
  now: number,
  effects: Effect[],
): PersistedState {
  switch (event.type) {
    case 'provider':
      return applyProviderEvent(state, event.event, event.durationSeconds, now, effects);

    case 'quizRendered':
      // The surface is alive, so the watchdog has nothing to fire on.
      return { ...state, renderDeadlineAt: null };

    case 'quizRenderFailed':
      // Fail open. A lock with no usable challenge behind it is a lockout.
      effects.push({ type: 'reportFault', reason: `quiz render failed: ${event.reason}` });
      return cleared(state, now);

    case 'quizPassed':
      return cleared(state, now);

    case 'quizFailed': {
      const round = 1;
      effects.push({ type: 'presentRemediation', round });
      return {
        ...withPhase(state, 'remediationLocked', now),
        remediationRound: round,
        renderDeadlineAt: now + WATCHDOG_MS,
      };
    }

    case 'remediationPassed':
      return cleared(state, now);

    case 'remediationFailed': {
      const round = state.remediationRound + 1;
      // Round 3 is the last. It clears whether she passed it or not, because a
      // child who has missed three rounds needs a parent, not a fourth quiz.
      if (round > CONFIG.remediation.maxRounds) return cleared(state, now);
      effects.push({ type: 'presentRemediation', round });
      return {
        ...state,
        remediationRound: round,
        renderDeadlineAt: now + WATCHDOG_MS,
        lastTransitionAt: now,
      };
    }

    case 'parentSkip':
      return cleared(state, now);

    case 'parentTimedUnlock':
      return {
        ...withPhase(state, 'parentUnlocked', now),
        parentUnlockExpiresAt: now + CONFIG.parent.timedUnlockMinutes * 60_000,
        renderDeadlineAt: null,
      };

    case 'parentDisableUntilRestart':
      return { ...withPhase(state, 'disabledUntilRestart', now), renderDeadlineAt: null };

    case 'recover': {
      // Startup, extension reload, or an ordinary worker wake. The obligation
      // is whatever storage says it is, which is what makes it survive a crash.
      if (state.phase === 'quizLocked' || state.phase === 'remediationLocked') {
        effects.push(
          state.remediationRound > 0
            ? { type: 'presentRemediation', round: state.remediationRound }
            : { type: 'presentQuiz', videoId: state.owedVideoId },
        );
        // The tab and window listeners died with the previous worker, so clear
        // the engaged flag to force a fresh engage on the way out.
        return { ...state, renderDeadlineAt: now + WATCHDOG_MS, lockEngaged: false };
      }
      // An obligation that never got as far as locking still stands.
      if (state.phase === 'quizPreparing' && state.owedVideoId) {
        effects.push({ type: 'presentQuiz', videoId: state.owedVideoId });
        return {
          ...withPhase(state, 'quizLocked', now),
          renderDeadlineAt: now + WATCHDOG_MS,
        };
      }
      return state;
    }

    case 'tick': {
      // The render watchdog. Checked here rather than by a timer, because an
      // MV3 worker cannot be relied on to still be alive holding one.
      if (state.renderDeadlineAt !== null && now >= state.renderDeadlineAt) {
        effects.push({ type: 'reportFault', reason: 'quiz surface never reported a render' });
        return cleared(state, now);
      }
      return state;
    }
  }
}

function applyProviderEvent(
  state: PersistedState,
  event: ProviderEvent,
  durationSeconds: number | null,
  now: number,
  effects: Effect[],
): PersistedState {
  switch (event.type) {
    case 'videoStarted': {
      // Starting a new video never clears an outstanding obligation.
      const carried = state.carryOverSeconds + state.activeWatchedSeconds;
      return {
        ...state,
        phase: state.owedVideoId ? state.phase : 'watching',
        activeVideoId: event.metadata.videoId,
        activeWatchedSeconds: 0,
        lastPositionSeconds: event.atSeconds,
        carryOverSeconds: state.owedVideoId ? state.carryOverSeconds : carried,
        lastTransitionAt: now,
      };
    }

    case 'progress': {
      if (event.videoId !== state.activeVideoId) return state;
      if (!event.playing) return { ...state, lastPositionSeconds: event.positionSeconds };

      const gained = elapsedBetween(state.lastPositionSeconds, event.positionSeconds);
      const watched = state.activeWatchedSeconds + gained;
      let next: PersistedState = {
        ...state,
        activeWatchedSeconds: watched,
        lastPositionSeconds: event.positionSeconds,
      };

      if (state.owedVideoId) return next;

      const reason = obligationReason(next, durationSeconds);
      if (reason) {
        // From here the challenge is owed no matter what she does next.
        next = {
          ...next,
          phase: 'quizPreparing',
          owedVideoId: event.videoId,
          owedReason: reason,
          lastTransitionAt: now,
        };
        effects.push({ type: 'startGeneration', videoId: event.videoId, reason });
      }
      return next;
    }

    case 'videoEnded': {
      if (state.owedVideoId !== event.videoId) return state;
      if (state.phase !== 'quizPreparing') return state;
      effects.push({ type: 'pausePlayback' });
      effects.push({ type: 'presentQuiz', videoId: event.videoId });
      return {
        ...withPhase(state, 'quizLocked', now),
        renderDeadlineAt: now + WATCHDOG_MS,
      };
    }

    case 'videoLeft': {
      // Skipping away after the threshold owes exactly as much as finishing.
      if (state.owedVideoId === event.videoId && state.phase === 'quizPreparing') {
        effects.push({ type: 'pausePlayback' });
        effects.push({ type: 'presentQuiz', videoId: event.videoId });
        return {
          ...withPhase(state, 'quizLocked', now),
          renderDeadlineAt: now + WATCHDOG_MS,
        };
      }
      // Left before owing anything. Bank the partial watch and move on.
      if (!state.owedVideoId) {
        return {
          ...state,
          carryOverSeconds: state.carryOverSeconds + state.activeWatchedSeconds,
          activeVideoId: null,
          activeWatchedSeconds: 0,
          lastPositionSeconds: 0,
          phase: 'idle',
          lastTransitionAt: now,
        };
      }
      return state;
    }

    case 'metadataUpdated':
    case 'transcriptUpdated':
    case 'transcriptUnavailable':
      // Content concerns, not lock concerns. The quiz engine consumes these.
      return state;
  }
}
