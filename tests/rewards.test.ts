import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config.js';
import { applyRound, BADGE_IDS, EMPTY_REWARDS, type RewardsState } from '../src/rewards/rewards.js';

const main = (correctCount: number, total: number, passed: boolean) => ({ round: 0, correctCount, total, passed });

describe('applyRound', () => {
  it('pays 10 XP per correct answer and no bonus short of perfect', () => {
    const { state, summary } = applyRound(EMPTY_REWARDS, main(4, 5, true));
    expect(summary.xpFromAnswers).toBe(40);
    expect(summary.perfectBonus).toBe(0);
    expect(state.xp).toBe(40);
    expect(state.perfectCount).toBe(0);
  });

  it('adds the perfect bonus on a perfect main challenge', () => {
    const { state, summary } = applyRound(EMPTY_REWARDS, main(3, 3, true));
    expect(summary.perfectBonus).toBe(CONFIG.rewards.xpPerfectBonus);
    expect(state.xp).toBe(55);
    expect(state.perfectCount).toBe(1);
  });

  it('never pays the perfect bonus in remediation', () => {
    const { summary } = applyRound(EMPTY_REWARDS, { round: 1, correctCount: 2, total: 2, passed: true });
    expect(summary.perfectBonus).toBe(0);
    expect(summary.xpFromAnswers).toBe(20);
  });

  it('moves the meter one step for a pass and two for a perfect', () => {
    expect(applyRound(EMPTY_REWARDS, main(4, 5, true)).state.meter).toBe(1);
    expect(applyRound(EMPTY_REWARDS, main(5, 5, true)).state.meter).toBe(2);
  });

  it('still pays XP for a missed round but leaves the meter alone', () => {
    const { state } = applyRound(EMPTY_REWARDS, main(2, 5, false));
    expect(state.xp).toBe(20);
    expect(state.meter).toBe(0);
    expect(state.challengesCleared).toBe(0);
  });

  it('reveals the next badge and carries the overflow when the meter fills', () => {
    const start: RewardsState = { ...EMPTY_REWARDS, meter: 9, badges: ['star'] };
    const { state, summary } = applyRound(start, main(3, 3, true));
    expect(summary.meterFilled).toBe(true);
    expect(summary.newBadge).toBe('bolt');
    expect(state.badges).toEqual(['star', 'bolt']);
    expect(state.meter).toBe(1);
    expect(state.meterFills).toBe(1);
  });

  it('keeps filling once every badge is owned', () => {
    const start: RewardsState = { ...EMPTY_REWARDS, meter: 9, badges: [...BADGE_IDS] };
    const { state, summary } = applyRound(start, main(4, 5, true));
    expect(summary.meterFilled).toBe(true);
    expect(summary.newBadge).toBeNull();
    expect(state.badges).toHaveLength(BADGE_IDS.length);
    expect(state.meter).toBe(0);
  });

  it('builds a streak on main passes and resets it on a main miss', () => {
    let state = EMPTY_REWARDS;
    state = applyRound(state, main(3, 3, true)).state;
    state = applyRound(state, main(4, 5, true)).state;
    expect(state.streak).toBe(2);
    state = applyRound(state, main(1, 3, false)).state;
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(2);
  });

  it('leaves the streak untouched during remediation', () => {
    const start: RewardsState = { ...EMPTY_REWARDS, streak: 0, bestStreak: 4 };
    const passed = applyRound(start, { round: 2, correctCount: 2, total: 2, passed: true }).state;
    expect(passed.streak).toBe(0);
    const failed = applyRound({ ...start, streak: 3 }, { round: 1, correctCount: 0, total: 2, passed: false }).state;
    expect(failed.streak).toBe(3);
  });

  it('has no badge listed twice', () => {
    expect(new Set(BADGE_IDS).size).toBe(BADGE_IDS.length);
  });
});
