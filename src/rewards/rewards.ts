/**
 * Cosmetic progression. Pure functions, same discipline as the round engine.
 *
 * Nothing in here can reach the lock. XP, the mystery meter, streaks and
 * badges are a record of what she has already done, never a currency: there is
 * no function that spends any of it, and no caller that reads it to decide
 * whether a video plays.
 */

import { CONFIG } from '../config.js';

/** The order badges are revealed in. Art and names live in ui/badges.ts. */
export const BADGE_IDS = [
  'star',
  'bolt',
  'moon',
  'diamond',
  'summit',
  'sun',
  'leaf',
  'shield',
  'drop',
  'crown',
  'heart',
  'hex',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface RewardsState {
  xp: number;
  /** Steps filled on the mystery meter, always below mysteryMeterSteps. */
  meter: number;
  /** Main challenges cleared in a row at the first attempt. */
  streak: number;
  bestStreak: number;
  perfectCount: number;
  challengesCleared: number;
  /** Times the meter has filled, which keeps counting once every badge is owned. */
  meterFills: number;
  badges: BadgeId[];
}

export const EMPTY_REWARDS: RewardsState = {
  xp: 0,
  meter: 0,
  streak: 0,
  bestStreak: 0,
  perfectCount: 0,
  challengesCleared: 0,
  meterFills: 0,
  badges: [],
};

export interface RoundResult {
  /** 0 is the main challenge. 1+ is a remediation round. */
  round: number;
  correctCount: number;
  total: number;
  passed: boolean;
}

/** What one finished round earned, for the result screen to show. */
export interface RewardSummary {
  xpFromAnswers: number;
  perfectBonus: number;
  totalXp: number;
  meterBefore: number;
  meterAfter: number;
  meterSteps: number;
  meterFilled: boolean;
  /** The badge this fill revealed. Null when the meter did not fill, or every badge is owned. */
  newBadge: BadgeId | null;
  badges: BadgeId[];
  /** Only ever shown when it is worth showing. A reset is silent. */
  streak: number;
}

export function applyRound(
  state: RewardsState,
  result: RoundResult,
): { state: RewardsState; summary: RewardSummary } {
  const { xpPerCorrectAnswer, xpPerfectBonus, mysteryMeterSteps } = CONFIG.rewards;
  const isMain = result.round === 0;
  const perfect = isMain && result.total > 0 && result.correctCount === result.total;

  const xpFromAnswers = result.correctCount * xpPerCorrectAnswer;
  const perfectBonus = perfect ? xpPerfectBonus : 0;

  // A cleared round moves the meter one step and a perfect challenge moves it
  // two. The final remediation round unlocks without a pass, and that is the
  // one ending that earns no step: the meter tracks what she got right.
  const stepsEarned = result.passed ? (perfect ? 2 : 1) : 0;
  const rawMeter = state.meter + stepsEarned;
  const meterFilled = rawMeter >= mysteryMeterSteps;
  const meterAfter = meterFilled ? rawMeter - mysteryMeterSteps : rawMeter;

  const newBadge = meterFilled ? (BADGE_IDS.find((id) => !state.badges.includes(id)) ?? null) : null;
  const badges = newBadge ? [...state.badges, newBadge] : state.badges;

  // Remediation neither extends nor breaks a streak. Only the main challenge
  // decides it, so a miss costs her the run exactly once.
  const streak = isMain ? (result.passed ? state.streak + 1 : 0) : state.streak;

  const next: RewardsState = {
    xp: state.xp + xpFromAnswers + perfectBonus,
    meter: meterAfter,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    perfectCount: state.perfectCount + (perfect ? 1 : 0),
    challengesCleared: state.challengesCleared + (result.passed ? 1 : 0),
    meterFills: state.meterFills + (meterFilled ? 1 : 0),
    badges,
  };

  return {
    state: next,
    summary: {
      xpFromAnswers,
      perfectBonus,
      totalXp: next.xp,
      meterBefore: state.meter,
      meterAfter,
      meterSteps: mysteryMeterSteps,
      meterFilled,
      newBadge,
      badges,
      streak,
    },
  };
}
