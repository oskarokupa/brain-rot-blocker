# Changelog

All notable changes to this project are logged here, most recent first.

## 2026-10-07 - Phase 8: child-facing UI and rewards (not yet tested live)

The challenge now looks like a screen YouTube Kids itself would show, speaks
English or Spanish, and pays out cosmetic rewards. The lock is unchanged: it
is still the redirect to `ui/quiz.html`, by the parent's decision.

- Tokens read off the live youtubekids.com with computed styles: brand red
  `#d90a17`, greys `#f4f4f4` / `#131313` / `#565656`, card shadow
  `0 2px 4px rgba(0,0,0,.24)`, 6px buttons, 32px pills, uppercase Roboto 500
  button labels, `0.1s ease-in` transitions. No logo or play mark anywhere.
- The site's heading face is YT Sans, which cannot be shipped. Headings fall
  back to Arial Rounded MT Bold (installed on every Mac) through a local
  `@font-face` alias. Roboto is bundled from `@fontsource/roboto` (a new dev
  dependency, three woff2 files copied at build) so the page never waits on a
  network font.
- The site has no success, "not quite" or reward colour and no dark theme on
  the web. Those are additions, documented at the top of `src/ui/styles.css`.
- New screens: intro with the pass mark, restyled single, multi and typed
  questions, an in-place "checking" state, feedback with XP, swaps left, the
  cleared screen with a rewards card, the kind miss screen into remediation,
  both remediation endings, and the full-meter badge reveal.
- UI text follows the language of the questions (`src/ui/strings.ts`):
  Spanish for bank quizzes, English for model-written ones.
- Rewards (`src/rewards/`): 10 XP per right answer, 25 XP perfect bonus, one
  meter step per cleared round and two for a perfect challenge, a streak that
  only the main challenge can extend or reset, and one badge from a set of 12
  each time the 10-step meter fills. Recorded after the lock transition, so a
  rewards storage fault cannot hold up an unlock. Nothing reads rewards to
  decide anything about viewing.
- Behaviour changes worth knowing when testing: the feedback screen now waits
  3 to 9 seconds depending on the length of the explanation (was a flat 1.8),
  and the cleared screen returns to the videos after 15 seconds (was 3), or
  waits for a tap when the meter is full.

## 2026-10-05 - Phase 4: LLM integration

Real video-based questions. Every quiz is now about the video she actually
watched when a transcript is available, rather than only ever coming from the
offline Spanish bank.

- Raw-fetch Anthropic client (`src/quiz/llm/anthropic.ts`), not the
  `@anthropic-ai/sdk` npm package. Deliberate: this project's own spec says
  to avoid dependencies beyond esbuild/TypeScript/vitest, an MV3 service
  worker isn't in the SDK's documented supported runtimes, and only two call
  shapes are ever needed. Uses `output_config.format` (`type: "json_schema"`)
  for server-guaranteed structure either way - that part of the SDK's benefit
  isn't SDK-exclusive.
- Fixed a real bug this surfaced: `CONFIG.llm.model` was
  `claude-haiku-4-5-20251001`. Current model ids never carry a date suffix;
  corrected to `claude-haiku-4-5`.
- Structured generation requests a flat bundle (3 single-select, 1 multi-select,
  1 typed, 2 spares, 6 remediation at two difficulty tiers) rather than a
  discriminated union, since JSON Schema support for that shape isn't
  something to assume. Converted to the normal `Question[]` shape and run
  through the same `validate.ts` phase 3 built - one regenerate attempt with
  the specific problems named, then the fallback bank.
- The full degrade chain lives in one place (`quiz/llm/generate.ts`): no API
  key, no transcript and no metadata, a timeout, a rate limit, or two failed
  validation attempts all end up at the bank. Never surfaces as an error to
  the child.
- Typed-answer grading gained its real second tier: an uncertain local verdict
  now gets a binary LLM judgment under a hard 2.5s timeout before falling
  back to the multiple-choice swap, which is now only what happens when the
  LLM genuinely isn't available.
- Repeat-avoidance wired in: prior questions asked about a rewatched video are
  read from history and named in the prompt as things not to repeat or
  closely paraphrase.
- API key entered via the parent panel (`chrome.storage.local`, PIN-gated to
  set, never written to disk as a file, never displayed back - only a masked
  hint once set). No key configured is a fully supported, permanent state:
  every challenge just uses the offline bank.
- 40 new tests (231 total): the client's HTTP-status classification and
  timeout handling against a mocked `fetch`, the full generate.ts degrade
  chain against a mocked API boundary, the typed-grading null-vs-verdict
  contract, and the API key store.
- `transcriptToText` moved out of `providers/youtubeKids/` to
  `providers/transcriptUtil.ts`: it has no provider-specific logic, and the
  service worker needed it without importing from inside a specific
  provider's folder, which the architecture doesn't allow.

**One more real gap, found by re-reading the plan against what got built:**
`CONFIG.llm.generateAtTranscriptFraction` (60%) was defined but never read -
generation fired the instant the watch threshold crossed, using whatever was
in the transcript cache at that exact moment, which is empty on a short video
if the caption fetch hasn't landed yet (the threshold is seconds watched, the
caption fetch is a network round trip, nothing tied the two together).
`startGeneration` now waits up to 5 seconds for coverage to reach the
configured fraction before proceeding with whatever is available. This costs
nothing user-facing: it happens in `quizPreparing`, before anything is locked,
while she is still watching the video it's generating questions about.

**Unconfirmed, flagged in NOTES.md:** whether the
`anthropic-dangerous-direct-browser-access` header raw fetch sends is still
the correct (or even necessary) mechanism - current live docs didn't name it
explicitly. Low risk either way; flagged for the first real test with a key.

**Known gaps:** neutral styling rather than native YouTube Kids (phase 8), no
XP or celebration polish yet (phase 8).


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


