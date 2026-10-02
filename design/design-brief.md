# Brain Rot Blocker: design brief

## What we're designing

Brain Rot Blocker is a private Chrome extension for one child on one Mac. It stops YouTube Kids from autoplaying into the next video. To keep watching, the child clears a short comprehension challenge about the video she has just seen. The questions come from the video's own transcript, and a language model writes them.

The aim is to turn passive scrolling into active watching without it feeling like a punishment. If the challenge screen reads as a detention slip, she will resent it. If it reads as a normal part of YouTube Kids that she's good at, she will play along. Design for the second.

Nobody else will ever see this. It won't go on the Chrome Web Store, so there's no marketing site, onboarding funnel or store listing to design.

## Who uses it

- **The child.** She sees the challenge screens and the rewards. She is between 9 and 14, a confident reader who will spot anything babyish or condescending straight away. Keep the targets comfortable and the sentences short, but pitch the tone at her age, not below it. She may be on a trackpad or a touchscreen.
- **The parent.** They use the settings and history panel and the PIN prompt. They're an adult on a laptop who opens it rarely, mostly to check progress or to unlock something by hand.

## Visual direction

- **Make it look native to YouTube Kids.** The challenge opens over youtubekids.com, so it should look like a screen the YouTube Kids app itself shows, not a third-party overlay. Match the site as it renders today: its colours, type, corner radii, button and chip shapes, spacing, card treatment and motion. Study the live site and borrow its visual language as closely as possible.
- **Borrow the language, not the logos.** Don't use the YouTube or YouTube Kids logo, wordmark or play-button mark on any screen. The screens should feel native through styling alone.
- **Derive tokens from the site.** Ignore the placeholder cream and brown colours in the code, which were stand-ins. Build a palette from what YouTube Kids uses, then add only what the site lacks: a success colour, a "not quite" colour that is kind rather than alarming, and a reward accent for XP. Each addition should look like it belongs on the site.
- **Light and dark themes**, following YouTube Kids' own behaviour where it has one.
- **The parent panel is the exception.** It lives on a Chrome extension page, not over the site, so it doesn't need to pass as YouTube Kids. Give it the same type and palette with a calmer, denser, more utilitarian layout, closer to a settings page than a kids' app.

## Surface 1: the challenge (child-facing)

This page opens over youtubekids.com the moment a challenge is owed, and the video pauses behind it. The content is capped at 640px wide and centred, and it has to work from a small laptop window up to full screen, respecting safe-area insets.

### How a challenge works

These rules are real, because they come from `src/config.ts`. The design has to express them, not invent new ones.

- **Length depends on the video.** A video up to 1 minute gets 1 question. Up to 3 minutes gets 3 questions. Anything longer gets 5.
- **Pass marks.** She needs 1 of 1, 3 of 3, or 4 of 5.
- **Question types:**
  - Single choice, the default type.
  - Multi-select: 5 options with 2 or 3 correct. The screen must make it obvious that she can pick more than one.
  - Typed answer: a short free-text reply, graded by the model in under 2.5 seconds. Show a brief "checking" state that never feels like a stall.
- **"This makes no sense" button.** She can throw away a confusing question and get a spare instead, up to 2 times per challenge. Show how many throws she has left, and make it feel legitimate to use rather than like cheating.
- **Progress dots** show where she is in the challenge. A 3-second long-press on the dots is the hidden gesture that opens the parent PIN prompt. Nothing should reveal it, but the dots have to be a real press target.
- **Remediation.** If she misses the pass mark, she doesn't just fail. She gets up to 3 remediation rounds of 2 questions each, and round 3 unlocks either way. Remediation always ends, so design it as "let's go over that bit again", never as a spiral.

### Rewards

Rewards are cosmetic only. They never buy extra viewing time, and the design must not suggest they do.

- 10 XP per correct answer, plus a 25 XP bonus for a perfect challenge.
- A "mystery meter" with 10 steps that fills over time towards some surprise. Design the meter and a moment for when it fills. What the surprise is doesn't exist yet, so propose something.

### Screens and states to design

1. **Getting ready.** Current copy: "Getting your challenge ready...". The questions are normally generated during playback, so this state is short, but it has to exist.
2. **Challenge intro.** Say how many questions there are and what she's aiming for, for example "3 questions, get them all".
3. **Question: single choice.**
4. **Question: multi-select.**
5. **Question: typed answer**, including the checking state.
6. **Answer feedback**, correct and incorrect, each with XP.
7. **"This makes no sense"**: pressing it, the swap to a spare question, and the state where no throws are left.
8. **Challenge passed.** XP earned, perfect bonus if any, mystery meter progress, then a clear "back to videos" action.
9. **Challenge missed, into remediation.** Kind framing, round 1 of 3.
10. **Remediation round.** The same question layout, with the round indicator visible.
11. **Remediation finished.** It unlocks whether she passed or not, and the tone should stay positive either way.
12. **Mystery meter full.** The celebration moment.
13. **Fallback questions.** When a video has no transcript, questions come from a built-in bank that is in Spanish (`fallback.language: 'es'`). The screen should look the same apart from a subtle cue that these are general questions rather than questions about the video.

## Surface 2: parent PIN prompt

- It opens only through the hidden long-press, so it lays over the challenge screen.
- A 4-digit PIN.
- After 5 wrong attempts there's a 30-second lockout. Show a countdown.
- A successful PIN offers a **15-minute timed unlock**, plus a way into the parent panel.
- States: entry, wrong PIN, locked out, success.

## Surface 3: parent panel (options page)

This is the extension's options page, reached from `chrome://extensions`. It also has to work as a recovery surface when the challenge screen is broken, so keep it plain HTML-friendly with no heavy dependencies.

### What exists today (phase 1 diagnostics)

- Title "Brain Rot Blocker", with the subtitle "Phase 1 diagnostics. Watch a few videos on YouTube Kids, then reload this page."
- Four stat tiles: videos seen, transcripts captured (with a percentage), human authored, and end detected.
- A table with the columns Video, Length, Transcript (yes/no, "(auto)", reason when missing), Lang, Cues, Coverage and End.
- Empty state: "Nothing recorded yet. Play a video on youtubekids.com."
- A "Clear diagnostics" button.

### What it becomes

- **Status at a glance**: locked or unlocked, time left on any timed unlock, and a big "Unlock now" control.
- **History**: the last 20 videos, each with up to 15 questions asked, her answers, the score and whether remediation happened. Design a list view and a drill-down per video.
- **Progress**: total XP, mystery meter state, perfect challenges and a streak if you think it helps.
- **Settings**: change PIN. Every other tunable (thresholds, question counts) lives in code on purpose, so don't design settings for those.
- **Diagnostics**: keep the current table, moved to a secondary tab.

## Copy tone

- For the child: short, direct and specific, pitched at 9 to 14 year olds. Praise specifics ("You remembered the bit about the volcano"), never a generic "Great job!" on repeat, and nothing that sounds like it was written for a 6-year-old. Never shame a wrong answer.
- For the parent: plain and factual.
- The extension's description line is "Earn the next video by clearing a short challenge about the one you just watched." That's the product in one sentence.

## Open questions for the designer

- The child-facing screens must work in both English and Spanish (the backup question bank is Spanish). Show at least the question screen in both, to check the layout copes with longer strings.
- The age range is wide, 9 to 14. Flag anything that would feel too young at 14 or too dense at 9.
- The mystery meter reward is undefined. Propose two or three options.

## What to deliver

- A small token set: colour for light and dark, type scale, radii, spacing and elevation.
- Components: answer option (single and multi), text input, primary and secondary buttons, progress dots, XP chip, mystery meter, PIN keypad, stat tile and table row.
- The screens listed under each surface, in light mode, plus dark mode for the question screen and the parent panel.
