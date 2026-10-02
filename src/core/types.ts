/**
 * The persisted state model.
 *
 * One field decides whether Chrome is locked. The earlier draft of the plan
 * carried both a "quizRequired" flag and a separate "QUIZ_PENDING" marker,
 * which is exactly how two sources of truth drift apart. There is one phase.
 */

export type Phase =
  /** Nothing owed, nothing playing. */
  | 'idle'
  /** A video is playing and has not yet crossed its threshold. */
  | 'watching'
  /**
   * The threshold has been crossed. A challenge is owed from this moment on,
   * but the video is still playing so nothing is locked yet. Generation runs
   * here, which is why the challenge can appear the instant playback stops.
   */
  | 'quizPreparing'
  /** Playback finished or she left. The challenge must be cleared. */
  | 'quizLocked'
  /** The pass mark was missed. Follow-up rounds are owed. */
  | 'remediationLocked'
  /** A parent unlocked for a fixed window. */
  | 'parentUnlocked'
  /** A parent switched the extension off until Chrome restarts. */
  | 'disabledUntilRestart';

/** Phases in which Chrome must be held. */
export const LOCKED_PHASES: readonly Phase[] = ['quizLocked', 'remediationLocked'];

export interface PersistedState {
  version: 1;
  phase: Phase;

  /** The video currently playing, if any. */
  activeVideoId: string | null;
  /** Seconds of the active video actually watched, excluding seeks. */
  activeWatchedSeconds: number;
  /** Last reported playback position, used to measure real elapsed watching. */
  lastPositionSeconds: number;

  /**
   * Sub-threshold watching accumulates here. Watching fourteen seconds and
   * skipping, over and over, would otherwise never owe anything.
   */
  carryOverSeconds: number;

  /** The video the owed challenge is about. Null when nothing is owed. */
  owedVideoId: string | null;
  /** Why a challenge is owed, which decides what kind of questions appear. */
  owedReason: 'videoThreshold' | 'carryOver' | null;

  /** Remediation round in progress, 0 when not in remediation. */
  remediationRound: number;

  /** Absolute epoch ms. Alarms can be delayed or dropped; a timestamp cannot. */
  parentUnlockExpiresAt: number | null;

  /**
   * When the quiz surface must have reported a successful render by. If this
   * passes with no heartbeat the watchdog releases the lock, because a quiz
   * that cannot draw itself is a lockout rather than a challenge.
   */
  renderDeadlineAt: number | null;

  lastTransitionAt: number;

  /**
   * What the enforcer was last told to do, as opposed to what the phase
   * implies it should be. Comparing the two is what makes an engage or a
   * release fire exactly once, and it is why a worker restart re-engages
   * correctly: the browser listeners are gone but this still says they were on.
   */
  lockEngaged: boolean;
}

export function initialState(now: number): PersistedState {
  return {
    version: 1,
    phase: 'idle',
    activeVideoId: null,
    activeWatchedSeconds: 0,
    lastPositionSeconds: 0,
    carryOverSeconds: 0,
    owedVideoId: null,
    owedReason: null,
    remediationRound: 0,
    parentUnlockExpiresAt: null,
    renderDeadlineAt: null,
    lastTransitionAt: now,
    lockEngaged: false,
  };
}

/**
 * Whether Chrome should be held right now. A timed parent unlock is checked
 * against the clock on every call rather than trusted to expire itself.
 */
export function isLocked(state: PersistedState, now: number): boolean {
  if (state.phase === 'disabledUntilRestart') return false;
  if (state.phase === 'parentUnlocked') {
    return state.parentUnlockExpiresAt !== null && now >= state.parentUnlockExpiresAt;
  }
  return LOCKED_PHASES.includes(state.phase);
}

/** Whether a challenge is owed, whether or not the lock has engaged yet. */
export function hasObligation(state: PersistedState): boolean {
  return state.owedVideoId !== null || state.phase === 'quizPreparing';
}
