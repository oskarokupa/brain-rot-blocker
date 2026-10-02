/**
 * Every tunable in the extension. Nothing else may hard-code a threshold,
 * timeout or limit. If a number matters, it lives here.
 */

export const CONFIG = {
  /** Watch accounting and when a challenge becomes owed. */
  watch: {
    /** Per-video threshold: min(seconds, duration * fractionOfDuration). */
    thresholdSeconds: 15,
    thresholdFractionOfDuration: 0.25,
    /**
     * A per-video threshold on its own is trivially gamed by watching just
     * under it and skipping. Sub-threshold viewing accumulates here, and once
     * the total crosses this budget a challenge is owed regardless.
     */
    carryOverBudgetSeconds: 60,
    /** How often the provider reports playback progress. */
    progressIntervalMs: 1000,
    /**
     * Playback position jumps larger than this are treated as seeking and do
     * not count toward accumulated watch time.
     */
    seekToleranceSeconds: 2,
  },

  /** Challenge length and pass marks, keyed by video duration. */
  quiz: {
    lengthBands: [
      { maxDurationSeconds: 60, questionCount: 1 },
      { maxDurationSeconds: 180, questionCount: 3 },
      { maxDurationSeconds: Infinity, questionCount: 5 },
    ],
    /**
     * Pass marks per length. The short forms demand everything because there
     * is no room for a margin; remediation absorbs the misses.
     */
    passMarks: { 1: 1, 3: 3, 5: 4 } as Record<number, number>,
    /** Spare questions generated for the "this makes no sense" button. */
    spareCount: 2,
    /** Times the child may discard a question per challenge. */
    maxDiscardsPerQuiz: 2,
    /** Multi-select shape. */
    multiSelect: { optionCount: 5, minCorrect: 2, maxCorrect: 3 },
  },

  /** Remediation always terminates. Round 3 unlocks either way. */
  remediation: {
    questionsPerRound: 2,
    maxRounds: 3,
    /** Questions generated up front so remediation survives losing the network. */
    pooledQuestionCount: 6,
  },

  /** Language model access. */
  llm: {
    model: 'claude-haiku-4-5-20251001',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiVersion: '2023-06-01',
    maxTokens: 4096,
    /** Whole-quiz generation. Generous, because it runs during playback. */
    generateTimeoutMs: 30_000,
    /** Typed-answer grading. She never waits longer than this. */
    typedGradeTimeoutMs: 2500,
    generateRetries: 1,
    /** Transcript share that must be captured before generation starts. */
    generateAtTranscriptFraction: 0.6,
    /** Hard cap on transcript characters sent upstream. */
    maxTranscriptChars: 12_000,
  },

  /** Lock behaviour. */
  lock: {
    /**
     * If the quiz page does not report a successful render inside this window,
     * the watchdog clears the lock. A crashed quiz UI plus a working enforcer
     * is otherwise a genuine lockout.
     */
    renderWatchdogMs: 8000,
    /** Re-check cadence while locked, as a backstop to the event listeners. */
    sweepAlarmMinutes: 1,
  },

  /** Parent controls. */
  parent: {
    pinLength: 4,
    pbkdf2Iterations: 310_000,
    timedUnlockMinutes: 15,
    /** Long-press duration on the progress dots to reach the PIN prompt. */
    gestureHoldMs: 3000,
    maxPinAttemptsBeforeDelay: 5,
    pinLockoutMs: 30_000,
  },

  /** Cosmetic progression. Never buys viewing time. */
  rewards: {
    xpPerCorrectAnswer: 10,
    xpPerfectBonus: 25,
    mysteryMeterSteps: 10,
  },

  /** Retention limits. */
  history: {
    maxVideos: 20,
    maxQuestionsPerVideo: 15,
  },

  /** Fallback question bank. */
  fallback: {
    language: 'es' as const,
    /** Questions that must pass before one may repeat. */
    noRepeatWindow: 40,
  },
} as const;

/** Questions owed for a video of the given duration. */
export function questionCountForDuration(durationSeconds: number): number {
  for (const band of CONFIG.quiz.lengthBands) {
    if (durationSeconds <= band.maxDurationSeconds) return band.questionCount;
  }
  return 5;
}

/** Correct answers needed to clear a challenge of the given length. */
export function passMarkForCount(questionCount: number): number {
  return CONFIG.quiz.passMarks[questionCount] ?? questionCount;
}

/** Seconds of this specific video that oblige a challenge. */
export function watchThresholdForDuration(durationSeconds: number): number {
  const { thresholdSeconds, thresholdFractionOfDuration } = CONFIG.watch;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return thresholdSeconds;
  return Math.min(thresholdSeconds, durationSeconds * thresholdFractionOfDuration);
}
