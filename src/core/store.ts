/**
 * The only way state reaches or leaves chrome.storage.local.
 *
 * Two properties matter here and nothing else does:
 *
 *  1. Writes are serialized. An MV3 worker runs many handlers against the same
 *     storage, and two of them reading the same snapshot and writing it back
 *     independently is how a cleared obligation comes back from the dead, or a
 *     live one silently disappears.
 *
 *  2. Unreadable state fails open. A stored shape this build does not
 *     understand must not leave a child locked with no way through.
 */

import type { CoreEvent, Effect } from './stateMachine.js';
import { reduce } from './stateMachine.js';
import { initialState, type PersistedState } from './types.js';

const STATE_KEY = 'state.v1';
const CURRENT_VERSION = 1;

/** Serializes every read-modify-write against storage into one chain. */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

function isValid(value: unknown): value is PersistedState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<PersistedState>;
  return (
    state.version === CURRENT_VERSION &&
    typeof state.phase === 'string' &&
    typeof state.carryOverSeconds === 'number' &&
    typeof state.lockEngaged === 'boolean'
  );
}

export async function readState(now: number): Promise<PersistedState> {
  const stored = await chrome.storage.local.get(STATE_KEY);
  const value = stored[STATE_KEY];
  if (isValid(value)) return value;
  if (value !== undefined) {
    // Written by a different build, or corrupted. Starting clean unlocks,
    // which is the right way round: a broken extension must not hold the
    // computer hostage. The alternative risks a lockout nobody can clear.
    console.warn('[brb] unreadable stored state, starting clean');
  }
  return initialState(now);
}

async function writeState(state: PersistedState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

export type EffectRunner = (effects: Effect[], state: PersistedState) => Promise<void> | void;

let runEffects: EffectRunner = () => undefined;

/** Set once at worker startup. Keeps the store free of browser concerns. */
export function setEffectRunner(runner: EffectRunner): void {
  runEffects = runner;
}

/**
 * Apply one event. The read, the transition and the write happen inside a
 * single queued step so no other handler can interleave with them.
 */
export function dispatch(event: CoreEvent, now = Date.now()): Promise<PersistedState> {
  return serialize(async () => {
    const current = await readState(now);
    const { state, effects } = reduce(current, event, now);

    // Persist before acting. If the worker dies between the two, the
    // obligation still stands and recovery re-runs the effects. The reverse
    // order could lock the browser with nothing recorded to unlock it.
    await writeState(state);

    if (effects.length > 0) {
      try {
        await runEffects(effects, state);
      } catch (err) {
        console.error('[brb] effect failed', err);
      }
    }
    return state;
  });
}

/** Clears everything. Used by the parent recovery control. */
export function resetState(now = Date.now()): Promise<void> {
  return serialize(async () => {
    await writeState(initialState(now));
  });
}
