/**
 * The challenge surface.
 *
 * Real question types, real grading, real scores: everything here reflects
 * what the service worker's quiz engine actually decided, never a result this
 * page invents for itself. That includes the rewards. XP, the mystery meter
 * and badges are worked out and stored in the worker, and this page only draws
 * the summary it is handed.
 *
 * One behaviour here is load-bearing, not presentation. This page must report
 * that it rendered. If the heartbeat never arrives, the worker's watchdog
 * takes over and returns her to YouTube Kids itself, because a challenge
 * screen that cannot draw itself is a lockout rather than a challenge, and
 * nothing on this page can be trusted to recover from that.
 */

import { CONFIG } from '../config.js';
import { openPinPrompt } from '../parent/pinPrompt.js';
import type { ActiveQuestionView, SubmitOutcome, UiLanguage } from '../quiz/quizStore.js';
import type { AnswerResponse, MultiSelectQuestion, Question, SingleSelectQuestion } from '../quiz/schema.js';
import type { RewardSummary } from '../rewards/rewards.js';
import { allBadgeIds, badgeName, renderBadge } from './badges.js';
import { browserLanguage, stringsFor, type Strings } from './strings.js';

type RoundCompleteOutcome = Extract<SubmitOutcome, { kind: 'roundComplete' }>;

const YOUTUBE_KIDS_URL = 'https://www.youtubekids.com/';
/** How long a finished challenge waits before returning on its own. */
const RESULT_SCREEN_MS = 15_000;
const INTERSTITIAL_MS = 6000;
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const ICON_CHECK = 'M9.5 17.6l-4.6-4.6L3 14.9l6.5 6.5L22 8.9 20.1 7z';
const ICON_RETRY = 'M12 5V2L7.5 6 12 10V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z';
const ICON_STAR = 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z';

const root = document.getElementById('root');

let language: UiLanguage = browserLanguage();
let t: Strings = stringsFor(language);
let introShown = false;

interface Reply<T> {
  ok: boolean;
  value?: T;
}

function send<T>(kind: string, extra: Record<string, unknown> = {}): Promise<T | undefined> {
  return chrome.runtime
    .sendMessage({ kind, ...extra })
    .then((reply: Reply<T> | undefined) => reply?.value)
    .catch(() => undefined);
}

// Any uncaught error during render has to reach the worker, otherwise the
// watchdog is the only thing standing between a bug and a locked computer.
window.addEventListener('error', (event) => {
  void send('quizRenderFailed', { reason: String(event.message) });
});
window.addEventListener('unhandledrejection', (event) => {
  void send('quizRenderFailed', { reason: String(event.reason) });
});

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(pathData: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

function setLanguage(next: UiLanguage): void {
  language = next;
  t = stringsFor(next);
  document.documentElement.lang = next;
  document.title = t.pageTitle;
}

/**
 * Swaps the whole screen. `takeover` is the full-colour treatment the site
 * itself uses for its own interruptions, kept for the moments between
 * questions. Question screens stay plain so the question is the loudest thing.
 */
function show(kind: 'plain' | 'takeover', ...nodes: Array<Node | null>): void {
  if (!root) return;
  document.body.dataset.screen = kind;
  const screen = el('div', 'screen');
  for (const node of nodes) if (node) screen.appendChild(node);
  root.replaceChildren(screen);
  // Screen readers and keyboards both follow the new heading, not the old button.
  const heading = screen.querySelector<HTMLElement>('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function xpChip(amount: number): HTMLElement {
  const chip = el('span', 'xp-chip');
  chip.append(icon(ICON_STAR, 'xp-star'), document.createTextNode(t.xp(amount)));
  return chip;
}

/**
 * Runs `action` once, on a click or after the pause, whichever comes first.
 * Without the guard, clicking right as the timer fires would run it twice and
 * skip a question.
 */
function once(action: () => void, autoAfterMs: number | null): () => void {
  let done = false;
  let timer: number | undefined;
  const run = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    action();
  };
  if (autoAfterMs !== null) timer = window.setTimeout(run, autoAfterMs);
  return run;
}

function confetti(): HTMLElement | null {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const layer = el('div', 'confetti');
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 18; i++) {
    const piece = el('span', `confetti-piece confetti-${i % 4}`);
    piece.style.left = `${(i * 53 + 7) % 100}%`;
    piece.style.animationDelay = `${(i % 6) * 90}ms`;
    piece.style.animationDuration = `${1400 + (i % 5) * 220}ms`;
    layer.appendChild(piece);
  }
  return layer;
}

/* ------------------------------------------------------------------ *
 * Rendering one question
 * ------------------------------------------------------------------ */

function renderProgress(view: ActiveQuestionView): HTMLElement {
  const dots = el('div', 'dots');
  dots.setAttribute('role', 'img');
  dots.setAttribute('aria-label', t.questionCounter(view.index + 1, view.total));
  for (let i = 0; i < view.total; i++) {
    dots.appendChild(el('span', i < view.index ? 'dot done' : i === view.index ? 'dot current' : 'dot'));
  }
  attachParentGesture(dots);
  return dots;
}

function optionButton(label: string, index: number, multi: boolean): HTMLButtonElement {
  const button = el('button', multi ? 'option option-multi' : 'option');
  button.type = 'button';
  const mark = el('span', 'option-mark', multi ? '' : (OPTION_LETTERS[index] ?? ''));
  if (multi) mark.appendChild(icon(ICON_CHECK, 'option-tick'));
  button.append(mark, el('span', 'option-label', label));
  return button;
}

function renderSingleSelect(question: SingleSelectQuestion, onSubmit: (r: AnswerResponse) => void): HTMLElement {
  const list = el('div', 'options');
  question.options.forEach((label, i) => {
    const button = optionButton(label, i, false);
    button.addEventListener('click', () => {
      button.classList.add('selected');
      onSubmit({ type: 'singleSelect', selectedIndex: i });
    });
    list.appendChild(button);
  });
  return list;
}

function renderMultiSelect(question: MultiSelectQuestion, onSubmit: (r: AnswerResponse) => void): HTMLElement {
  const wrap = el('div', 'multi-wrap');
  wrap.appendChild(el('p', 'hint', t.multiHint));

  const list = el('div', 'options');
  const selected = new Set<number>();
  const submit = el('button', 'primary-button', t.check);
  submit.type = 'button';
  submit.disabled = true;

  question.options.forEach((label, i) => {
    const button = optionButton(label, i, true);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const on = !selected.has(i);
      if (on) selected.add(i);
      else selected.delete(i);
      button.classList.toggle('selected', on);
      button.setAttribute('aria-pressed', String(on));
      submit.disabled = selected.size === 0;
    });
    list.appendChild(button);
  });

  submit.addEventListener('click', () => onSubmit({ type: 'multiSelect', selectedIndices: [...selected] }));

  wrap.append(list, submit);
  return wrap;
}

function renderTyped(onSubmit: (r: AnswerResponse) => void): HTMLElement {
  const wrap = el('div', 'typed-wrap');
  const input = document.createElement('input');
  input.className = 'typed-input';
  input.type = 'text';
  input.placeholder = t.typedPlaceholder;
  input.setAttribute('aria-label', t.typedLabel);
  input.autocomplete = 'off';
  input.spellcheck = false;

  const submit = el('button', 'primary-button', t.check);
  submit.type = 'button';
  submit.disabled = true;

  const trySubmit = () => {
    if (input.value.trim().length === 0) return;
    onSubmit({ type: 'typed', text: input.value });
  };
  input.addEventListener('input', () => {
    submit.disabled = input.value.trim().length === 0;
  });
  submit.addEventListener('click', trySubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') trySubmit();
  });

  wrap.append(el('p', 'hint', t.typedLabel), input, submit);
  window.setTimeout(() => input.focus(), 0);
  return wrap;
}

function renderDiscardRow(view: ActiveQuestionView): HTMLElement | null {
  // Remediation has no spares, so the row would only ever be a dead end there.
  if (view.round > 0 || view.maxDiscards === 0) return null;

  const row = el('div', 'discard-row');
  if (view.discardsLeft > 0) {
    const discard = el('button', 'text-button', t.discard);
    discard.type = 'button';
    discard.addEventListener('click', () => void handleDiscard());
    row.append(discard, el('span', 'discard-count', t.discardsLeft(view.discardsLeft)));
  } else {
    row.append(el('span', 'discard-count', t.noDiscardsLeft));
  }
  return row;
}

/* ------------------------------------------------------------------ *
 * The loop: fetch a question, render it, submit, show feedback, repeat
 * ------------------------------------------------------------------ */

/**
 * A failed fetch here used to report the fault and stop, leaving whatever was
 * already on screen (on a fresh load, the static "Getting your challenge
 * ready..." placeholder from quiz.html itself) displayed indefinitely if the
 * worker's own forced redirect did not land. The worker waking from an idle
 * suspension is a normal, transient reason this can fail once, so one retry
 * happens before anything is declared broken, and declaring it broken now
 * always replaces what is on screen rather than leaving it untouched.
 */
async function loadAndRenderQuestion(attempt = 1, notice?: string): Promise<void> {
  const view = await send<ActiveQuestionView>('quizGetQuestion');
  if (view) {
    setLanguage(view.language);

    // Only a challenge she has not touched yet gets the intro. A reload part
    // way through goes straight back to the question she was on.
    const untouched = view.round === 0 && view.index === 0 && view.discardsLeft === view.maxDiscards;
    if (untouched && !introShown) showIntro(view);
    else renderQuestion(view, notice);
    return;
  }

  if (attempt === 1) {
    window.setTimeout(() => void loadAndRenderQuestion(2, notice), 700);
    return;
  }

  // Nothing to show after a retry. Say so on screen immediately rather than
  // trusting the fault report alone to move her somewhere else in time.
  show('plain', el('p', 'status', t.somethingWrong));
  void send('quizRenderFailed', { reason: 'no active question after retry' });
}

function showIntro(view: ActiveQuestionView): void {
  introShown = true;
  const start = el('button', 'primary-button on-takeover', t.start);
  start.type = 'button';
  start.addEventListener('click', () => renderQuestion(view));

  show(
    'takeover',
    el('h1', 'display', t.introTitle),
    el('p', 'lede', t.introGoal(view.total, view.passMark)),
    el('p', 'takeover-note', view.source === 'fallback' ? t.generalQuestionsNote : t.introNote),
    start,
  );

  // The page has genuinely drawn a challenge screen, which is what the
  // watchdog is waiting to hear, whether or not she has pressed Start yet.
  void send('quizReady');
}

function renderQuestion(view: ActiveQuestionView, notice?: string): void {
  const top = el('div', 'top');
  const counter =
    view.round > 0
      ? t.roundCounter(view.round, CONFIG.remediation.maxRounds)
      : t.questionCounter(view.index + 1, view.total);
  top.append(renderProgress(view), el('p', 'counter', counter));

  const status = el('p', 'status');
  status.setAttribute('aria-live', 'polite');
  if (notice) status.textContent = notice;

  const onSubmit = (response: AnswerResponse) => {
    // The question stays where it is while the answer is checked. Swapping to
    // an empty "checking" screen made a two second wait feel like a stall.
    for (const control of body.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')) {
      control.disabled = true;
    }
    discardRow?.remove();
    status.textContent = t.checking;
    status.classList.add('checking');
    void handleSubmit(response, view);
  };

  let body: HTMLElement;
  if (view.question.type === 'singleSelect') body = renderSingleSelect(view.question, onSubmit);
  else if (view.question.type === 'multiSelect') body = renderMultiSelect(view.question, onSubmit);
  else body = renderTyped(onSubmit);

  const discardRow = renderDiscardRow(view);

  show(
    'plain',
    top,
    view.source === 'fallback' ? el('span', 'chip', t.generalQuestions) : null,
    el('h1', 'prompt', view.question.prompt),
    body,
    status,
    discardRow,
  );

  // The round has genuinely rendered. Harmless to send again, and this is the
  // simplest place to guarantee it fires for every question in the round.
  void send('quizReady');
}

async function handleDiscard(): Promise<void> {
  const result = await send<{ ok: boolean; question: Question | null }>('quizDiscard');
  if (result?.ok) void loadAndRenderQuestion(1, t.swapped);
}

async function handleSubmit(response: AnswerResponse, view: ActiveQuestionView): Promise<void> {
  const outcome = await send<SubmitOutcome>('quizSubmitAnswer', { response });
  if (!outcome || outcome.kind === 'noActiveQuestion') {
    void send('quizRenderFailed', { reason: 'submit returned no active question' });
    return;
  }

  if (outcome.kind === 'needsRetry') {
    // The typed answer could not be confidently graded locally and there is
    // no LLM to ask, so the question becomes its multiple-choice twin. This
    // does not count as a discard and does not cost her anything. Re-fetched
    // rather than rendered from the reply: the worker stays the only source
    // of truth for what is actually active.
    void loadAndRenderQuestion(1, t.tryDifferentWay);
    return;
  }

  if (outcome.kind === 'answered') {
    showFeedback(outcome.correct, outcome.explanation, outcome.xp, view.index, () => void loadAndRenderQuestion());
    return;
  }

  showFeedback(outcome.correct, outcome.explanation, outcome.xp, view.index, () => showRoundEnd(outcome, view));
}

function showFeedback(
  correct: boolean,
  explanation: string,
  xp: number,
  questionIndex: number,
  onContinue: () => void,
): void {
  const headlines = correct ? t.correctHeadlines : t.incorrectHeadlines;
  const headline = headlines[questionIndex % headlines.length] ?? '';

  const mark = el('span', correct ? 'verdict verdict-correct' : 'verdict verdict-retry');
  mark.appendChild(icon(correct ? ICON_CHECK : ICON_RETRY, 'verdict-icon'));

  // The explanation is the specific praise: it names the bit of the video she
  // got right, or what the answer was. Long ones get longer on screen.
  const pause = Math.min(9000, Math.max(3000, explanation.length * 65));
  const advance = once(onContinue, pause);

  const next = el('button', 'primary-button', t.next);
  next.type = 'button';
  next.addEventListener('click', advance);

  show(
    'plain',
    mark,
    el('h1', correct ? 'prompt feedback-correct' : 'prompt feedback-retry', headline),
    el('p', 'explanation', explanation),
    xp > 0 ? xpChip(xp) : null,
    next,
  );
}

/* ------------------------------------------------------------------ *
 * The end of a round
 * ------------------------------------------------------------------ */

function showRoundEnd(outcome: RoundCompleteOutcome, view: ActiveQuestionView): void {
  if (!outcome.cleared) {
    showMovingToRemediation(view.round + 1);
    return;
  }
  showCleared(outcome, view);
}

function showMovingToRemediation(nextRound: number): void {
  const advance = once(() => void loadAndRenderQuestion(), INTERSTITIAL_MS);
  const go = el('button', 'primary-button on-takeover', t.go);
  go.type = 'button';
  go.addEventListener('click', advance);

  show(
    'takeover',
    el('p', 'eyebrow', t.missedRound(nextRound, CONFIG.remediation.maxRounds)),
    el('h1', 'display', t.missedTitle),
    el('p', 'lede', t.missedBody(CONFIG.remediation.questionsPerRound)),
    go,
  );
}

function renderMeter(rewards: RewardSummary): HTMLElement {
  const wrap = el('div', 'meter-wrap');
  const shown = rewards.meterFilled ? rewards.meterSteps : rewards.meterAfter;

  const head = el('div', 'meter-head');
  head.append(el('span', 'meter-label', t.meterLabel), el('span', 'meter-count', t.meterProgress(shown, rewards.meterSteps)));

  const meter = el('div', 'meter');
  meter.setAttribute('role', 'img');
  meter.setAttribute('aria-label', `${t.meterLabel}, ${t.meterProgress(shown, rewards.meterSteps)}`);
  for (let i = 0; i < rewards.meterSteps; i++) {
    const isNew = i >= rewards.meterBefore && i < shown;
    const step = el('span', i < rewards.meterBefore ? 'meter-step on' : isNew ? 'meter-step on new' : 'meter-step');
    if (isNew) step.style.animationDelay = `${400 + (i - rewards.meterBefore) * 220}ms`;
    meter.appendChild(step);
  }

  wrap.append(head, meter);
  return wrap;
}

function renderRewards(rewards: RewardSummary): HTMLElement {
  const card = el('div', 'reward-card');

  const rows = el('dl', 'reward-rows');
  const addRow = (label: string, amount: number, className = '') => {
    const row = el('div', `reward-row ${className}`.trim());
    row.append(el('dt', '', label), el('dd', '', t.xp(amount)));
    rows.appendChild(row);
  };
  addRow(t.answersRow, rewards.xpFromAnswers);
  if (rewards.perfectBonus > 0) addRow(t.perfectRow, rewards.perfectBonus, 'reward-row-bonus');
  card.appendChild(rows);

  const totals = el('div', 'reward-totals');
  totals.appendChild(el('span', 'chip chip-xp', t.totalXp(rewards.totalXp)));
  // A streak of one is not a streak, and a broken one is never mentioned.
  if (rewards.streak >= 2) totals.appendChild(el('span', 'chip', t.streak(rewards.streak)));
  card.append(totals, renderMeter(rewards));

  return card;
}

/**
 * The obligation has ended, which is not the same as the round's score
 * passing. The last remediation round unlocks either way, and that ending is
 * written to read as a fresh start rather than as a failure.
 */
function showCleared(outcome: RoundCompleteOutcome, view: ActiveQuestionView): void {
  const rewards = outcome.rewards;
  const perfect = view.round === 0 && outcome.correctCount === outcome.total;

  let title: string;
  let body: string;
  if (view.round === 0) {
    title = perfect ? t.passedPerfect : t.passed;
    body = t.score(outcome.correctCount, outcome.total);
  } else if (outcome.passed) {
    title = t.remediationPassedTitle;
    body = t.remediationPassedBody;
  } else {
    title = t.remediationEndedTitle;
    body = t.remediationEndedBody;
  }

  const meterFull = rewards?.meterFilled === true;
  const action = el('button', 'primary-button', meterFull ? t.meterFullCta : t.backToVideos);
  action.type = 'button';
  // A full meter waits for her to open it. Everything else heads back to the
  // videos on its own, so the button is a convenience and not the only way out.
  const proceed = once(
    () => (meterFull && rewards ? showMeterFull(rewards) : returnToYoutubeKids()),
    meterFull ? null : RESULT_SCREEN_MS,
  );
  action.addEventListener('click', proceed);

  const mark = el('span', outcome.passed ? 'verdict verdict-correct' : 'verdict verdict-retry');
  mark.appendChild(icon(outcome.passed ? ICON_CHECK : ICON_RETRY, 'verdict-icon'));

  show(
    'plain',
    perfect ? confetti() : null,
    mark,
    el('h1', 'display display-plain', title),
    el('p', 'lede lede-plain', body),
    rewards && (rewards.xpFromAnswers > 0 || rewards.meterAfter !== rewards.meterBefore || meterFull)
      ? renderRewards(rewards)
      : null,
    action,
  );
}

function showMeterFull(rewards: RewardSummary): void {
  const ids = allBadgeIds();
  const owned = new Set(rewards.badges);

  const back = el('button', 'primary-button on-takeover', t.backToVideos);
  back.type = 'button';
  back.addEventListener('click', returnToYoutubeKids);

  const hero = rewards.newBadge
    ? renderBadge(rewards.newBadge, true, badgeName(rewards.newBadge, language))
    : null;
  hero?.classList.add('badge-hero');

  const shelf = el('div', 'badge-shelf');
  for (const id of ids) {
    const has = owned.has(id);
    const badge = renderBadge(id, has, has ? badgeName(id, language) : t.lockedBadge);
    if (id === rewards.newBadge) badge.classList.add('badge-new');
    shelf.appendChild(badge);
  }

  show(
    'takeover',
    confetti(),
    hero,
    el('h1', 'display', rewards.newBadge ? t.badgeTitle : t.allBadgesTitle),
    el('p', 'lede', rewards.newBadge ? t.badgeBody(badgeName(rewards.newBadge, language)) : t.allBadgesBody),
    el('p', 'eyebrow', t.collection(owned.size, ids.length)),
    shelf,
    back,
  );
}

function returnToYoutubeKids(): void {
  window.location.href = YOUTUBE_KIDS_URL;
}

/* ------------------------------------------------------------------ *
 * Hidden parent gesture
 * ------------------------------------------------------------------ */

function attachParentGesture(target: HTMLElement): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const start = () => {
    cancel();
    timer = setTimeout(openParentPanel, CONFIG.parent.gestureHoldMs);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  target.addEventListener('pointerdown', start);
  target.addEventListener('pointerup', cancel);
  target.addEventListener('pointerleave', cancel);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('contextmenu', (e) => e.preventDefault());
}

function openParentPanel(): void {
  openPinPrompt({ title: 'Parent access', onSuccess: showParentActions });
}

function showParentActions(): void {
  const list = el('div', 'options');

  const actions: Array<[string, string]> = [
    ['Skip this challenge', 'parentSkip'],
    [`Unlock for ${CONFIG.parent.timedUnlockMinutes} minutes`, 'parentTimedUnlock'],
    ['Turn off until Chrome restarts', 'parentDisableUntilRestart'],
  ];

  for (const [label, kind] of actions) {
    const button = el('button', 'option option-plain', label);
    button.type = 'button';
    // No self-navigation here: these all end in a non-silent releaseLock
    // effect, which moves the tab from the background the moment the state
    // machine processes the message. That is more reliable than this page
    // doing it, since it does not depend on this page's JS still running by
    // the time the message round-trip completes.
    button.addEventListener('click', () => void send(kind));
    list.appendChild(button);
  }

  const back = el('button', 'option option-plain', 'Back to the challenge');
  back.type = 'button';
  back.addEventListener('click', () => {
    void send('parentEndSession');
    void loadAndRenderQuestion();
  });
  list.appendChild(back);

  show('plain', el('h1', 'prompt', 'Parent controls'), list);
}

if (root) {
  setLanguage(language);
  const loading = root.querySelector('.loading');
  if (loading) loading.textContent = t.gettingReady;
  // Asks for the heading face while the first question is still being
  // fetched, so the first heading does not paint in the fallback and swap.
  void document.fonts.load('700 1em "BRB Display"').catch(() => undefined);
  void loadAndRenderQuestion();
}

// Keeps this file a module rather than a global script once bundled.
export {};
