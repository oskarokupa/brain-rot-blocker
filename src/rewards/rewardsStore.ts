/**
 * Persists the cosmetic progression.
 *
 * Its own key and its own write queue, for the same reason the quiz store has
 * one: a race or a corrupt value here must never be able to touch the lock
 * state. A failure to read or write rewards costs her some XP at worst.
 */

import { applyRound, EMPTY_REWARDS, type RewardSummary, type RewardsState, type RoundResult } from './rewards.js';

const REWARDS_KEY = 'rewards.v1';

let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

async function read(): Promise<RewardsState> {
  const stored = await chrome.storage.local.get(REWARDS_KEY);
  // Spread over the empty state so a document written before a field existed
  // still reads as complete.
  return { ...EMPTY_REWARDS, ...((stored[REWARDS_KEY] as Partial<RewardsState>) ?? {}) };
}

export function getRewards(): Promise<RewardsState> {
  return serialize(read);
}

export function recordRound(result: RoundResult): Promise<RewardSummary> {
  return serialize(async () => {
    const { state, summary } = applyRound(await read(), result);
    await chrome.storage.local.set({ [REWARDS_KEY]: state });
    return summary;
  });
}
