import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { reduce, type CoreEvent, type Effect } from '../src/core/stateMachine.js';
import { initialState, isLocked, type PersistedState } from '../src/core/types.js';
import type { ProviderEvent, VideoMetadata } from '../src/providers/types.js';

const T0 = 1_700_000_000_000;

function meta(videoId: string, durationSeconds: number | null = 300): VideoMetadata {
  return { videoId, title: 't', durationSeconds, channel: null, description: null };
}

/** Drives a sequence of events through the reducer, collecting every effect. */
function run(
  start: PersistedState,
  events: Array<[CoreEvent, number?]>,
): { state: PersistedState; effects: Effect[] } {
  let state = start;
  const effects: Effect[] = [];
  let clock = T0;
  for (const [event, at] of events) {
    clock = at ?? clock;
    const out = reduce(state, event, clock);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

function provider(event: ProviderEvent, durationSeconds: number | null = 300): CoreEvent {
  return { type: 'provider', event, durationSeconds };
}

/** Plays a video from 0 to `toSeconds`, one tick per second so nothing counts as a seek. */
function play(videoId: string, toSeconds: number): Array<[CoreEvent, number?]> {
  const steps: Array<[CoreEvent, number?]> = [
    [provider({ type: 'videoStarted', metadata: meta(videoId), atSeconds: 0 })],
  ];
  for (let s = 1; s <= toSeconds; s++) {
    steps.push([
      provider({ type: 'progress', videoId, positionSeconds: s, playing: true }),
    ]);
  }
  return steps;
}

const kinds = (effects: Effect[]) => effects.map((e) => e.type);

describe('watch threshold', () => {
  it('owes nothing when a video is abandoned before the threshold', () => {
    const { state, effects } = run(initialState(T0), play('v1', 10));
    expect(state.owedVideoId).toBeNull();
    expect(state.phase).toBe('watching');
    expect(kinds(effects)).not.toContain('startGeneration');
  });

  it('owes a challenge once the threshold is crossed, and starts generating', () => {
    const { state, effects } = run(initialState(T0), play('v1', 16));
    expect(state.owedVideoId).toBe('v1');
    expect(state.owedReason).toBe('videoThreshold');
    expect(state.phase).toBe('quizPreparing');
    expect(kinds(effects)).toContain('startGeneration');
  });

  it('does not lock while the video is still playing', () => {
    const { state } = run(initialState(T0), play('v1', 20));
    expect(isLocked(state, T0)).toBe(false);
  });

  it('scales the threshold down for short videos', () => {
    // A 40 second video owes after 10 seconds, not 15.
    const steps = play('short', 11).map(
      ([e]) =>
        [
          e.type === 'provider' ? { ...e, durationSeconds: 40 } : e,
          undefined,
        ] as [CoreEvent, number?],
    );
    const { state } = run(initialState(T0), steps);
    expect(state.owedVideoId).toBe('short');
  });

  it('ignores seeking, so scrubbing to the end owes nothing', () => {
    const { state } = run(initialState(T0), [
      [provider({ type: 'videoStarted', metadata: meta('v1'), atSeconds: 0 })],
      [provider({ type: 'progress', videoId: 'v1', positionSeconds: 290, playing: true })],
      [provider({ type: 'progress', videoId: 'v1', positionSeconds: 299, playing: true })],
    ]);
    expect(state.owedVideoId).toBeNull();
    expect(state.activeWatchedSeconds).toBe(0);
  });

  it('does not count time while paused', () => {
    const { state } = run(initialState(T0), [
      [provider({ type: 'videoStarted', metadata: meta('v1'), atSeconds: 0 })],
      [provider({ type: 'progress', videoId: 'v1', positionSeconds: 1, playing: false })],
      [provider({ type: 'progress', videoId: 'v1', positionSeconds: 2, playing: false })],
    ]);
    expect(state.activeWatchedSeconds).toBe(0);
  });
});

describe('the skip loop', () => {
  it('eventually owes a challenge to a child who watches just under the threshold and skips', () => {
    // Fourteen seconds then skip, repeatedly. Each round owes nothing on its
    // own, but the carry-over budget accumulates.
    let state = initialState(T0);
    let owedAfter = -1;

    for (let round = 0; round < 10; round++) {
      const id = `v${round}`;
      const out = run(state, [
        ...play(id, 14),
        [provider({ type: 'videoLeft', videoId: id, nextVideoId: `v${round + 1}` })],
      ]);
      state = out.state;
      if (state.owedVideoId !== null) {
        owedAfter = round + 1;
        break;
      }
    }

    expect(owedAfter).toBeGreaterThan(0);
    // 60 second budget over 14 second bites converges within about five skips.
    expect(owedAfter).toBeLessThanOrEqual(5);
  });

  it('banks partial watching when she leaves before owing anything', () => {
    const { state } = run(initialState(T0), [
      ...play('v1', 10),
      [provider({ type: 'videoLeft', videoId: 'v1', nextVideoId: 'v2' })],
    ]);
    expect(state.carryOverSeconds).toBe(10);
    expect(state.phase).toBe('idle');
  });

  it('resets the budget once a challenge is cleared', () => {
    const { state } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
      [{ type: 'quizPassed' }],
    ]);
    expect(state.carryOverSeconds).toBe(0);
    expect(state.owedVideoId).toBeNull();
  });
});

describe('locking', () => {
  it('locks when a video owing a challenge ends', () => {
    const { state, effects } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]);
    expect(state.phase).toBe('quizLocked');
    expect(isLocked(state, T0)).toBe(true);
    expect(kinds(effects)).toContain('engageLock');
    expect(kinds(effects)).toContain('pausePlayback');
    expect(kinds(effects)).toContain('presentQuiz');
  });

  it('locks just the same when she skips away after the threshold', () => {
    const { state, effects } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoLeft', videoId: 'v1', nextVideoId: 'v2' })],
    ]);
    expect(state.phase).toBe('quizLocked');
    expect(kinds(effects)).toContain('engageLock');
  });

  it('keeps the obligation when another video starts', () => {
    const { state } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoLeft', videoId: 'v1', nextVideoId: 'v2' })],
      [provider({ type: 'videoStarted', metadata: meta('v2'), atSeconds: 0 })],
    ]);
    expect(state.owedVideoId).toBe('v1');
    expect(isLocked(state, T0)).toBe(true);
  });

  it('locks on the owed video when a different one starts and the leave was never reported', () => {
    // A tab refresh after the threshold: no videoLeft ever arrives for v1.
    const { state, effects } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoStarted', metadata: meta('v2'), atSeconds: 0 })],
    ]);
    expect(state.phase).toBe('quizLocked');
    expect(state.owedVideoId).toBe('v1');
    expect(isLocked(state, T0)).toBe(true);
    expect(effects).toContainEqual({ type: 'presentQuiz', videoId: 'v1' });
  });

  it('keeps preparing when the owed video itself restarts, as after a refresh', () => {
    const { state } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoStarted', metadata: meta('v1'), atSeconds: 0 })],
    ]);
    expect(state.phase).toBe('quizPreparing');
    expect(isLocked(state, T0)).toBe(false);
  });

  it('emits engageLock exactly once across a lock and unlock cycle', () => {
    const { effects } = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
      [{ type: 'quizRendered' }],
      [{ type: 'quizPassed' }],
    ]);
    expect(kinds(effects).filter((k) => k === 'engageLock')).toHaveLength(1);
    expect(kinds(effects).filter((k) => k === 'releaseLock')).toHaveLength(1);
  });

  it('ignores an end event for a video that owed nothing', () => {
    const { state, effects } = run(initialState(T0), [
      ...play('v1', 5),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]);
    expect(isLocked(state, T0)).toBe(false);
    expect(kinds(effects)).not.toContain('engageLock');
  });
});

describe('recovery after a restart', () => {
  it('restores the lock when storage says a challenge was pending', () => {
    const locked = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;

    // Chrome restarts. The worker wakes with only what was persisted.
    const { state, effects } = run(locked, [[{ type: 'recover' }, T0 + 60_000]]);
    expect(state.phase).toBe('quizLocked');
    expect(isLocked(state, T0 + 60_000)).toBe(true);
    expect(kinds(effects)).toContain('presentQuiz');
  });

  it('still locks when the crash happened before the video ended', () => {
    const owedButPlaying = run(initialState(T0), play('v1', 16)).state;
    expect(owedButPlaying.phase).toBe('quizPreparing');

    const { state, effects } = run(owedButPlaying, [[{ type: 'recover' }, T0 + 60_000]]);
    expect(state.phase).toBe('quizLocked');
    expect(kinds(effects)).toContain('engageLock');
  });

  it('does nothing on recovery when nothing was owed', () => {
    const { state, effects } = run(initialState(T0), [[{ type: 'recover' }]]);
    expect(state.phase).toBe('idle');
    expect(effects).toHaveLength(0);
  });
});

describe('remediation always terminates', () => {
  function lockedState(): PersistedState {
    return run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
  }

  it('moves into round 1 when the pass mark is missed', () => {
    const { state, effects } = run(lockedState(), [[{ type: 'quizFailed' }]]);
    expect(state.phase).toBe('remediationLocked');
    expect(state.remediationRound).toBe(1);
    expect(kinds(effects)).toContain('presentRemediation');
  });

  it('unlocks as soon as a remediation round is passed', () => {
    const { state } = run(lockedState(), [
      [{ type: 'quizFailed' }],
      [{ type: 'remediationPassed' }],
    ]);
    expect(isLocked(state, T0)).toBe(false);
    expect(state.remediationRound).toBe(0);
  });

  it('unlocks after the final round even when she fails every single one', () => {
    const { state, effects } = run(lockedState(), [
      [{ type: 'quizFailed' }],
      [{ type: 'remediationFailed' }],
      [{ type: 'remediationFailed' }],
      [{ type: 'remediationFailed' }],
    ]);
    expect(isLocked(state, T0)).toBe(false);
    expect(state.phase).toBe('idle');
    expect(kinds(effects)).toContain('releaseLock');
  });

  it('never runs more rounds than the configured maximum', () => {
    let state = lockedState();
    state = reduce(state, { type: 'quizFailed' }, T0).state;
    let rounds = 0;
    while (isLocked(state, T0) && rounds < 20) {
      state = reduce(state, { type: 'remediationFailed' }, T0).state;
      rounds++;
    }
    expect(rounds).toBeLessThanOrEqual(CONFIG.remediation.maxRounds);
    expect(isLocked(state, T0)).toBe(false);
  });
});

describe('anti-lockout', () => {
  function lockedState(): PersistedState {
    return run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
  }

  it('sets a render deadline the moment it locks', () => {
    expect(lockedState().renderDeadlineAt).toBe(T0 + CONFIG.lock.renderWatchdogMs);
  });

  it('clears the deadline once the surface reports a render', () => {
    const { state } = run(lockedState(), [[{ type: 'quizRendered' }]]);
    expect(state.renderDeadlineAt).toBeNull();
  });

  it('unlocks when the quiz surface never renders', () => {
    const { state, effects } = run(lockedState(), [
      [{ type: 'tick' }, T0 + CONFIG.lock.renderWatchdogMs + 1],
    ]);
    expect(isLocked(state, T0 + CONFIG.lock.renderWatchdogMs + 1)).toBe(false);
    expect(kinds(effects)).toContain('reportFault');
    expect(kinds(effects)).toContain('releaseLock');
  });

  it('unlocks when the quiz surface reports that it crashed', () => {
    const { state, effects } = run(lockedState(), [
      [{ type: 'quizRenderFailed', reason: 'TypeError' }],
    ]);
    expect(isLocked(state, T0)).toBe(false);
    expect(kinds(effects)).toContain('reportFault');
  });

  it('does not fire the watchdog once the surface is alive', () => {
    const { state } = run(lockedState(), [
      [{ type: 'quizRendered' }],
      [{ type: 'tick' }, T0 + CONFIG.lock.renderWatchdogMs * 10],
    ]);
    expect(isLocked(state, T0 + CONFIG.lock.renderWatchdogMs * 10)).toBe(true);
  });
});

describe('parent override', () => {
  function lockedState(): PersistedState {
    return run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
  }

  it('skipping clears the obligation outright', () => {
    const { state } = run(lockedState(), [[{ type: 'parentSkip' }]]);
    expect(isLocked(state, T0)).toBe(false);
    expect(state.owedVideoId).toBeNull();
  });

  it('a timed unlock holds for exactly the configured window', () => {
    const { state } = run(lockedState(), [[{ type: 'parentTimedUnlock' }]]);
    const window = CONFIG.parent.timedUnlockMinutes * 60_000;
    expect(isLocked(state, T0)).toBe(false);
    expect(isLocked(state, T0 + window - 1)).toBe(false);
    expect(isLocked(state, T0 + window)).toBe(true);
  });

  it('re-locks on the next tick after the window expires', () => {
    const unlocked = run(lockedState(), [[{ type: 'parentTimedUnlock' }]]).state;
    const window = CONFIG.parent.timedUnlockMinutes * 60_000;
    const { state, effects } = run(unlocked, [[{ type: 'tick' }, T0 + window + 1]]);
    expect(state.phase).toBe('quizLocked');
    expect(kinds(effects)).toContain('engageLock');
  });

  it('expiry survives being read long after any alarm would have fired', () => {
    const unlocked = run(lockedState(), [[{ type: 'parentTimedUnlock' }]]).state;
    // No timer ran at all. The absolute timestamp still decides.
    expect(isLocked(unlocked, T0 + 86_400_000)).toBe(true);
  });

  it('disabling until restart unlocks and stays unlocked', () => {
    const { state } = run(lockedState(), [[{ type: 'parentDisableUntilRestart' }]]);
    expect(isLocked(state, T0)).toBe(false);
    expect(isLocked(state, T0 + 86_400_000)).toBe(false);
  });
});

/**
 * Whether a release is "silent" decides whether the background worker yanks
 * the tab away immediately or trusts something already on screen to leave on
 * its own. Getting this backwards either cuts off her success screen before
 * she sees it, or leaves a parent action sitting on the challenge page forever.
 */
describe('releaseLock silence', () => {
  function releaseEffect(effects: Effect[]): Extract<Effect, { type: 'releaseLock' }> | undefined {
    return effects.find((e): e is Extract<Effect, { type: 'releaseLock' }> => e.type === 'releaseLock');
  }

  it('is silent on a genuine pass, so the success screen is not cut off', () => {
    const locked = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
    const { effects } = run(locked, [[{ type: 'quizPassed' }]]);
    expect(releaseEffect(effects)?.silent).toBe(true);
  });

  it('is silent when remediation is passed', () => {
    const locked = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
      [{ type: 'quizFailed' }],
    ]).state;
    const { effects } = run(locked, [[{ type: 'remediationPassed' }]]);
    expect(releaseEffect(effects)?.silent).toBe(true);
  });

  it('is silent when the final remediation round clears regardless of its own score', () => {
    let state = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
      [{ type: 'quizFailed' }],
    ]).state;
    state = reduce(state, { type: 'remediationFailed' }, T0).state;
    state = reduce(state, { type: 'remediationFailed' }, T0).state;
    // Third failure: the state machine clears unconditionally, and the UI
    // frames this as cleared too, so the release must not be forced.
    const { effects } = reduce(state, { type: 'remediationFailed' }, T0);
    expect(releaseEffect(effects)?.silent).toBe(true);
  });

  it('is not silent on a parent skip, which has no success screen to protect', () => {
    const locked = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
    const { effects } = run(locked, [[{ type: 'parentSkip' }]]);
    expect(releaseEffect(effects)?.silent).toBe(false);
  });

  it('is not silent on a timed unlock', () => {
    const locked = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
    const { effects } = run(locked, [[{ type: 'parentTimedUnlock' }]]);
    expect(releaseEffect(effects)?.silent).toBe(false);
  });

  it('is not silent on a render fault, which has no reliable screen at all', () => {
    const locked = run(initialState(T0), [
      ...play('v1', 16),
      [provider({ type: 'videoEnded', videoId: 'v1' })],
    ]).state;
    const { effects } = run(locked, [[{ type: 'quizRenderFailed', reason: 'boom' }]]);
    expect(releaseEffect(effects)?.silent).toBe(false);
  });
});
