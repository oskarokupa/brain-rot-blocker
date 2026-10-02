# Changelog

All notable changes to this project are logged here, most recent first.

## 2026-10-01 - Phase 6: parent PIN

Pulled ahead of the quiz engine, because the lock went live on the target
machine with an unprotected unlock control.

- 4-digit PIN hashed with PBKDF2-SHA256, 310,000 iterations, random 16-byte
  salt. Verification runs in the service worker, so no page ever sees the hash.
- Constant-time comparison on the derived key.
- Five wrong attempts triggers a 30-second throttle that refuses even the
  correct PIN until it expires.
- A correct PIN opens a 5-minute session rather than authorising one action, so
  a parent can skip a challenge and set a timed unlock without retyping.
- Hidden gesture: a 3-second long press on the challenge progress dots opens
  the PIN prompt. Nothing advertises it.
- Parent actions behind the PIN: skip the challenge, unlock for 15 minutes,
  turn off until Chrome restarts.
- Options page gains PIN set and change, plus a timed unlock control.
- With no PIN configured the controls stay open on purpose, and the panel says
  so. Shutting a parent out of their own extension is the worse failure.
- 17 PIN tests, 69 total.

**Escape hatch if the PIN is forgotten:** remove and reinstall the extension.
That clears storage, and the lock with it.

**Phase 1 verified on the target profile:** the caption hook captures
transcripts on youtubekids.com for most videos.


## 2026-10-01 - Phase 2: state machine and lock

- Explicit state machine as pure functions (`src/core/stateMachine.ts`), with no
  browser calls, so every lock transition is testable without Chrome.
- Single persisted phase replaces the earlier pair of overlapping flags.
- Carry-over watch budget closes the skip loop: watching just under the
  threshold and skipping repeatedly now converges on a challenge.
- Lock enforcer sweeps tabs that were already open, and re-checks on tab
  activation and window focus, not only on tab creation.
- Render watchdog releases the lock if the challenge surface never reports a
  successful render, so a crashed quiz page cannot become a lockout.
- Remediation terminates by construction: round 3 clears whether passed or not.
- Timed parent unlock stored as an absolute timestamp rather than trusted to an
  alarm, which an extension update would drop.
- Serialized storage writes, so concurrent handlers cannot lose an obligation.
- Recovery runs on startup, on install or reload, and on every worker wake.
- Parent panel gains lock status and an unconditional "Unlock now" recovery
  control, allowlisted by the enforcer so it stays reachable while locked.
- Working dummy challenge so the full lock cycle can be exercised end to end.
- 52 tests passing.

**Known gaps:** no PIN on the unlock control yet (phase 7), placeholder
questions (phase 4), neutral styling rather than native YouTube Kids (phase 8).


