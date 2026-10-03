# Changelog

All notable changes to this project are logged here, most recent first.

## 2026-10-03 - Phase 3: the real quiz engine

Replaces the three hard-coded dummy questions with a working challenge: real
question types, real grading, real scores, driving the real lock. No LLM yet;
every quiz comes from a local Spanish fallback bank, which is also exactly
what a genuine LLM or network failure degrades to in phase 4.

- Question schema for single-select, typed, and multi-select
  (`src/quiz/schema.ts`), and a structural validator (`validate.ts`) that
  every quiz passes through regardless of source: right option counts, no
  "all/none of the above", no answer-giveaway option-length imbalance, no
  duplicate questions, exactly the 3/1/1 type mix on a five-question quiz.
- Grading (`grade.ts`), pure and chrome-free like the state machine:
  single and multi-select are exact; typed answers get a local ladder (exact
  match, then keyword overlap) with a **negation guard** that stops "plants do
  not need sunlight" from matching "plants need sunlight" on keyword overlap
  alone. Never returns a confident wrong answer, only correct or uncertain.
- Round engine (`engine.ts`): scoring against the per-length pass marks,
  the discard ("this doesn't make sense") mechanic, and the swap to a typed
  question's multiple-choice twin when local grading can't reach a verdict
  and there is no LLM to ask.
- Fallback bank (`fallback/bank.es.ts`, 36 questions, Spain Year 4 Spanish,
  both subjects, all three types) and selection logic that respects a
  no-repeat window and falls back to a repeat rather than coming up short.
  **Written as typed TypeScript data, not bank.es.json as the plan named it**,
  so a malformed entry is a compile error instead of a runtime surprise.
  36 is seed content, not the SOP's 150-200 target; growing it is writing more
  questions, not touching any selection or grading code.
- Scoring moved server-side (`quizStore.ts`): the challenge page asks for a
  question, submits an answer, and is told the result. It can no longer
  report its own pass or fail, closing an escape route the phase 2 dummy left
  open by trusting the page to call `quizPassed` on itself.
- Real challenge UI: single-select, multi-select ("Select all that apply",
  exact-match only), typed input with a brief checking state, the discard
  button with remaining count, and separated per-question feedback from the
  round-complete summary so remediation and a perfect score read differently.

**Two real bugs, caught by writing the tests before trusting the code:**
- The negation guard's `\bn't\b` pattern requires a word boundary immediately
  before "n", which doesn't exist in "don't" (the "n" is glued to "o"), so it
  silently never matched any contraction. Fixed to `n't\b`.
- Three bank questions had option sets over the 3x length-ratio the validator
  itself enforces, and would have been rejected by the code that is supposed
  to catch exactly that in LLM output. Rephrased rather than loosening the
  check.

**One gap found by tracing the unlock paths, not by a test:** making
`releaseLock()` do nothing (so a pass's success screen isn't cut off by an
immediate redirect) broke the options page's "Unlock now" recovery control and
every parent action, none of which would have moved the stuck tab anywhere.
Fixed with a `silent` flag on the `releaseLock` effect: true only for a
genuine pass (including the final remediation round, which clears regardless
of its own score), false for everything else, which now forces the tab back
to YouTube Kids immediately. Six new state machine tests pin this down.

191 tests passing (up from 69).

**Known gaps:** no LLM integration (phase 4), neutral styling rather than
native YouTube Kids (phase 8), no XP or celebration polish yet (phase 8).

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


