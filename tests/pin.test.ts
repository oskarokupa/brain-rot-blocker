import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

/**
 * The PIN module runs in the service worker, so it needs chrome.storage and
 * WebCrypto. Node supplies the crypto; storage is faked with a plain object,
 * which also lets a test inspect exactly what gets persisted.
 */
const store: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
      set: async (items: Record<string, unknown>) => void Object.assign(store, items),
      remove: async (key: string) => void delete store[key],
    },
  },
});

if (!globalThis.crypto) vi.stubGlobal('crypto', webcrypto);
vi.stubGlobal('btoa', (s: string) => Buffer.from(s, 'binary').toString('base64'));
vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('binary'));

const { setPin, verifyPin, hasPin, hasValidSession, endSession, isValidPinFormat } = await import(
  '../src/parent/pin.js'
);

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('PIN format', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPinFormat('1234')).toBe(true);
    expect(isValidPinFormat('0000')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidPinFormat('123')).toBe(false);
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('12a4')).toBe(false);
    expect(isValidPinFormat('')).toBe(false);
  });

  it('refuses to store a badly formed PIN', async () => {
    expect(await setPin('12')).toBe(false);
    expect(await hasPin()).toBe(false);
  });
});

describe('storage', () => {
  it('never writes the PIN itself', async () => {
    await setPin('4815');
    const serialised = JSON.stringify(store);
    expect(serialised).not.toContain('4815');
  });

  it('salts, so the same PIN stores differently each time', async () => {
    await setPin('1234');
    const first = JSON.stringify(store['parentPin.v1']);
    for (const key of Object.keys(store)) delete store[key];
    await setPin('1234');
    const second = JSON.stringify(store['parentPin.v1']);
    expect(first).not.toBe(second);
  });
});

describe('verification', () => {
  it('accepts the right PIN', async () => {
    await setPin('2468');
    expect((await verifyPin('2468')).ok).toBe(true);
  });

  it('rejects the wrong PIN', async () => {
    await setPin('2468');
    expect((await verifyPin('1357')).ok).toBe(false);
  });

  it('counts down remaining attempts', async () => {
    await setPin('2468');
    expect((await verifyPin('0000')).attemptsLeft).toBe(4);
    expect((await verifyPin('0000')).attemptsLeft).toBe(3);
  });

  it('throttles after five wrong attempts', async () => {
    await setPin('2468');
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) await verifyPin('0000', now);
    const fifth = await verifyPin('0000', now);
    expect(fifth.ok).toBe(false);
    expect(fifth.lockedUntil).toBe(now + 30_000);
  });

  it('refuses even the correct PIN while throttled', async () => {
    await setPin('2468');
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) await verifyPin('0000', now);
    expect((await verifyPin('2468', now + 1000)).ok).toBe(false);
  });

  it('lets the correct PIN through once the throttle expires', async () => {
    await setPin('2468');
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) await verifyPin('0000', now);
    expect((await verifyPin('2468', now + 30_001)).ok).toBe(true);
  });

  it('resets the failure count after a success', async () => {
    await setPin('2468');
    await verifyPin('0000');
    await verifyPin('0000');
    await verifyPin('2468');
    expect((await verifyPin('0000')).attemptsLeft).toBe(4);
  });
});

describe('no PIN configured', () => {
  it('lets a parent through rather than shutting them out', async () => {
    expect(await hasPin()).toBe(false);
    expect((await verifyPin('')).ok).toBe(true);
  });

  it('treats every session as valid, so controls stay reachable', async () => {
    expect(await hasValidSession()).toBe(true);
  });
});

describe('sessions', () => {
  it('opens on a correct PIN and closes on demand', async () => {
    await setPin('1111');
    expect(await hasValidSession()).toBe(false);
    await verifyPin('1111');
    expect(await hasValidSession()).toBe(true);
    await endSession();
    expect(await hasValidSession()).toBe(false);
  });

  it('does not open on a wrong PIN', async () => {
    await setPin('1111');
    await verifyPin('9999');
    expect(await hasValidSession()).toBe(false);
  });

  it('expires on its own after five minutes', async () => {
    await setPin('1111');
    const now = 5_000_000;
    await verifyPin('1111', now);
    expect(await hasValidSession(now + 4 * 60_000)).toBe(true);
    expect(await hasValidSession(now + 5 * 60_000 + 1)).toBe(false);
  });
});
