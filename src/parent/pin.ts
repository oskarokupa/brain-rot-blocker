/**
 * Parent PIN.
 *
 * Runs only in the service worker. The stored hash never reaches the challenge
 * page or the options page: those send a candidate PIN and get back a verdict.
 *
 * Threat model, stated honestly. A four digit PIN is ten thousand
 * combinations, and chrome.storage.local is readable through DevTools by
 * anyone who knows where to look. PBKDF2 at this iteration count makes an
 * offline sweep of the whole keyspace slow but not impossible for a motivated
 * adult. It is sized to stop a child who is curious and persistent, which is
 * the actual threat, not to resist an attacker with the device and real
 * intent. The in-extension attempt throttle is the part that matters day to
 * day.
 */

import { CONFIG } from '../config.js';

const PIN_KEY = 'parentPin.v1';
const ATTEMPTS_KEY = 'parentAttempts.v1';
const SESSION_KEY = 'parentSession.v1';

/** How long a successful PIN entry keeps the parent controls open. */
const SESSION_MS = 5 * 60_000;

interface PinRecord {
  saltB64: string;
  hashB64: string;
  iterations: number;
  createdAt: number;
}

interface AttemptRecord {
  failures: number;
  lockedUntil: number | null;
}

export interface VerifyResult {
  ok: boolean;
  /** Set when the throttle is active. Epoch ms. */
  lockedUntil?: number;
  attemptsLeft?: number;
}

/* ------------------------------------------------------------------ *
 * Crypto
 * ------------------------------------------------------------------ */

function toB64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromB64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toB64(bits);
}

/** Constant time comparison, so a wrong PIN cannot be narrowed by timing. */
function equals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * Storage
 * ------------------------------------------------------------------ */

async function readPin(): Promise<PinRecord | null> {
  const stored = await chrome.storage.local.get(PIN_KEY);
  return (stored[PIN_KEY] as PinRecord) ?? null;
}

async function readAttempts(): Promise<AttemptRecord> {
  const stored = await chrome.storage.local.get(ATTEMPTS_KEY);
  return (stored[ATTEMPTS_KEY] as AttemptRecord) ?? { failures: 0, lockedUntil: null };
}

async function writeAttempts(record: AttemptRecord): Promise<void> {
  await chrome.storage.local.set({ [ATTEMPTS_KEY]: record });
}

/* ------------------------------------------------------------------ *
 * Public surface
 * ------------------------------------------------------------------ */

export async function hasPin(): Promise<boolean> {
  return (await readPin()) !== null;
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${CONFIG.parent.pinLength}}$`).test(pin);
}

export async function setPin(pin: string): Promise<boolean> {
  if (!isValidPinFormat(pin)) return false;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = CONFIG.parent.pbkdf2Iterations;
  const hashB64 = await derive(pin, salt, iterations);
  await chrome.storage.local.set({
    [PIN_KEY]: {
      saltB64: toB64(salt.buffer as ArrayBuffer),
      hashB64,
      iterations,
      createdAt: Date.now(),
    } satisfies PinRecord,
  });
  await writeAttempts({ failures: 0, lockedUntil: null });
  return true;
}

export async function verifyPin(pin: string, now = Date.now()): Promise<VerifyResult> {
  const attempts = await readAttempts();
  if (attempts.lockedUntil !== null && now < attempts.lockedUntil) {
    return { ok: false, lockedUntil: attempts.lockedUntil };
  }

  const record = await readPin();
  // No PIN configured yet. Open on purpose: a parent who has not set one must
  // not be shut out of their own extension.
  if (!record) {
    await grantSession(now);
    return { ok: true };
  }

  const candidate = await derive(pin, fromB64(record.saltB64), record.iterations);
  if (equals(candidate, record.hashB64)) {
    await writeAttempts({ failures: 0, lockedUntil: null });
    await grantSession(now);
    return { ok: true };
  }

  const failures = attempts.failures + 1;
  if (failures >= CONFIG.parent.maxPinAttemptsBeforeDelay) {
    const lockedUntil = now + CONFIG.parent.pinLockoutMs;
    await writeAttempts({ failures: 0, lockedUntil });
    return { ok: false, lockedUntil };
  }
  await writeAttempts({ failures, lockedUntil: null });
  return { ok: false, attemptsLeft: CONFIG.parent.maxPinAttemptsBeforeDelay - failures };
}

/* ------------------------------------------------------------------ *
 * Sessions
 *
 * A verified PIN opens a short window rather than authorising one action, so
 * a parent can skip a challenge and then set a timed unlock without typing it
 * twice. Stored as an absolute timestamp for the same reason the timed unlock
 * is: an extension update drops alarms, but not storage.
 * ------------------------------------------------------------------ */

async function grantSession(now: number): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: now + SESSION_MS });
}

export async function hasValidSession(now = Date.now()): Promise<boolean> {
  // An extension with no PIN set has no gate to pass.
  if (!(await hasPin())) return true;
  const stored = await chrome.storage.local.get(SESSION_KEY);
  const expiresAt = stored[SESSION_KEY] as number | undefined;
  return typeof expiresAt === 'number' && now < expiresAt;
}

export async function endSession(): Promise<void> {
  await chrome.storage.local.remove(SESSION_KEY);
}
