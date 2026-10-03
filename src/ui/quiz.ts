/**
 * The challenge surface.
 *
 * Real question types, real grading, real scores: everything here reflects
 * what the service worker's quiz engine actually decided, never a result this
 * page invents for itself. The one thing still neutral is the look, which
 * stays plain until phase 8 builds the native YouTube Kids treatment on top of
 * this same structure.
 *
 * One behaviour here is load-bearing, not a placeholder. This page must
 * report that it rendered. If the heartbeat never arrives, the worker's
 * watchdog takes over and returns her to YouTube Kids itself, because a
 * challenge screen that cannot draw itself is a lockout rather than a
 * challenge, and nothing on this page can be trusted to recover from that.
 */

import { CONFIG } from '../config.js';
import { openPinPrompt } from '../parent/pinPrompt.js';
import type { AnswerResponse, MultiSelectQuestion, Question, SingleSelectQuestion } from '../quiz/schema.js';

interface ActiveQuestionView {
  question: Question;
  index: number;
  total: number;
  discardsLeft: number;
  round: number;
}

type SubmitOutcome =
  | { kind: 'answered'; correct: boolean; explanation: string }
  | { kind: 'roundComplete'; correct: boolean; explanation: string; correctCount: number; total: number; cleared: boolean }
  | { kind: 'needsRetry'; question: Question }
  | { kind: 'noActiveQuestion' };

const YOUTUBE_KIDS_URL = 'https://www.youtubekids.com/';
const SUCCESS_SCREEN_MS = 3000;

const root = document.getElementById('root');

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
 * Rendering one question
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

function renderProgress(view: ActiveQuestionView): HTMLElement {
  const dots = el('div', 'dots');
  for (let i = 0; i < view.total; i++) {
    dots.appendChild(el('span', i < view.index ? 'dot done' : i === view.index ? 'dot current' : 'dot'));
  }
  attachParentGesture(dots);
  return dots;
}

function renderSingleSelect(question: SingleSelectQuestion, onSubmit: (r: AnswerResponse) => void): HTMLElement {
  const list = el('div', 'options');
  question.options.forEach((label, i) => {
    const button = el('button', 'option', label);
    button.addEventListener('click', () => onSubmit({ type: 'singleSelect', selectedIndex: i }));
    list.appendChild(button);
  });
  return list;
}

function renderMultiSelect(question: MultiSelectQuestion, onSubmit: (r: AnswerResponse) => void): HTMLElement {
  const wrap = el('div', 'multi-wrap');
  wrap.appendChild(el('p', 'hint', 'Select all that apply.'));

  const list = el('div', 'options');
  const selected = new Set<number>();

  question.options.forEach((label, i) => {
    const button = el('button', 'option', label);
    button.addEventListener('click', () => {
      if (selected.has(i)) {
        selected.delete(i);
        button.classList.remove('selected');
      } else {
        selected.add(i);
        button.classList.add('selected');
      }
    });
    list.appendChild(button);
  });

  const submit = el('button', 'primary-button', 'Submit');
  submit.addEventListener('click', () => onSubmit({ type: 'multiSelect', selectedIndices: [...selected] }));

  wrap.append(list, submit);
  return wrap;
}

function renderTyped(onSubmit: (r: AnswerResponse) => void): HTMLElement {
  const wrap = el('div', 'typed-wrap');
  const input = document.createElement('input');
  input.className = 'typed-input';
  input.type = 'text';
  input.placeholder = 'Type your answer';
  input.autocomplete = 'off';

  const submit = el('button', 'primary-button', 'Submit');
  const trySubmit = () => {
    if (input.value.trim().length === 0) return;
    onSubmit({ type: 'typed', text: input.value });
  };
  submit.addEventListener('click', trySubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') trySubmit();
  });

  wrap.append(input, submit);
  return wrap;
}

function renderChecking(): HTMLElement {
  return el('p', 'note checking', 'Checking...');
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
async function loadAndRenderQuestion(attempt = 1): Promise<void> {
  const view = await send<ActiveQuestionView>('quizGetQuestion');
  if (view) {
    renderQuestion(view);
    return;
  }

  if (attempt === 1) {
    window.setTimeout(() => void loadAndRenderQuestion(2), 700);
    return;
  }

  // Nothing to show after a retry. Say so on screen immediately rather than
  // trusting the fault report alone to move her somewhere else in time.
  if (root) {
    root.replaceChildren(
      el('p', 'note', "Something went wrong. We're sending you back to your video."),
    );
  }
  void send('quizRenderFailed', { reason: 'no active question after retry' });
}

function renderQuestion(view: ActiveQuestionView): void {
  if (!root) return;
  root.replaceChildren();

  const progress = renderProgress(view);
  const counter = el(
    'p',
    'counter',
    view.round > 0 ? `Bonus round ${view.round} of ${CONFIG.remediation.maxRounds}` : `Question ${view.index + 1} of ${view.total}`,
  );
  const prompt = el('h1', 'prompt', view.question.prompt);

  const onSubmit = (response: AnswerResponse) => {
    root.replaceChildren(progress, counter, prompt, renderChecking());
    void handleSubmit(response);
  };

  let body: HTMLElement;
  if (view.question.type === 'singleSelect') body = renderSingleSelect(view.question, onSubmit);
  else if (view.question.type === 'multiSelect') body = renderMultiSelect(view.question, onSubmit);
  else body = renderTyped(onSubmit);

  root.append(progress, counter, prompt, body);

  if (view.discardsLeft > 0 && view.round === 0) {
    const discard = el('button', 'discard-button', "This question doesn't make sense");
    discard.addEventListener('click', () => void handleDiscard());
    root.appendChild(discard);
  }

  // The round has genuinely rendered. Only reported the first time through,
  // but harmless to send again, and this is the simplest place to guarantee
  // it fires for every question in the round, not only the first.
  void send('quizReady');
}

async function handleDiscard(): Promise<void> {
  const result = await send<{ ok: boolean; question: Question | null }>('quizDiscard');
  if (result?.ok) void loadAndRenderQuestion();
}

async function handleSubmit(response: AnswerResponse): Promise<void> {
  const outcome = await send<SubmitOutcome>('quizSubmitAnswer', { response });
  if (!outcome || outcome.kind === 'noActiveQuestion') {
    void send('quizRenderFailed', { reason: 'submit returned no active question' });
    return;
  }

  if (outcome.kind === 'needsRetry') {
    // The typed answer could not be confidently graded locally and there is
    // no LLM to ask, so the question becomes its multiple-choice twin. This
    // does not count as a discard and does not cost her anything.
    renderNeedsRetry();
    return;
  }

  if (outcome.kind === 'answered') {
    showFeedback(outcome.correct, outcome.explanation, () => void loadAndRenderQuestion());
    return;
  }

  // roundComplete
  showFeedback(outcome.correct, outcome.explanation, () => {
    if (outcome.cleared) showSuccess(outcome.correctCount, outcome.total);
    else showMovingToRemediation();
  });
}

/**
 * Re-fetches rather than rendering the replacement question it was handed:
 * the server is still the only source of truth for what is actually active,
 * and a fresh read is cheap insurance against racing another tab's discard.
 */
function renderNeedsRetry(): void {
  if (!root) return;
  root.replaceChildren(el('p', 'note', "Let's try that one a different way."));
  window.setTimeout(() => void loadAndRenderQuestion(), 900);
}

function showFeedback(correct: boolean, explanation: string, onContinue: () => void): void {
  if (!root) return;
  root.replaceChildren();
  root.appendChild(el('h1', `prompt ${correct ? 'feedback-correct' : 'feedback-incorrect'}`, correct ? 'Nice one!' : 'Almost!'));
  root.appendChild(el('p', 'note', explanation));

  // Runs exactly once, whichever fires first: a manual click or the
  // auto-advance. Without the guard, clicking right as the timer fires would
  // call onContinue twice and skip a question.
  let advanced = false;
  const advanceOnce = () => {
    if (advanced) return;
    advanced = true;
    window.clearTimeout(autoAdvance);
    onContinue();
  };

  const next = el('button', 'primary-button', 'Continue');
  next.addEventListener('click', advanceOnce);
  root.appendChild(next);

  // Keeps the challenge moving on its own after a short pause, so a tap on
  // "Continue" is a convenience rather than the only way forward.
  const autoAdvance = window.setTimeout(advanceOnce, 1800);
}

function showMovingToRemediation(): void {
  if (!root) return;
  root.replaceChildren();
  root.appendChild(el('h1', 'prompt', "Let's go over that again."));
  root.appendChild(el('p', 'note', 'Two quick questions, then another video is unlocked.'));
  window.setTimeout(() => void loadAndRenderQuestion(), 1600);
}

function showSuccess(correctCount: number, total: number): void {
  if (!root) return;
  root.replaceChildren();
  const perfect = correctCount === total;
  root.appendChild(el('h1', 'prompt feedback-correct', perfect ? 'Perfect!' : 'Challenge cleared!'));
  root.appendChild(el('p', 'note', `${correctCount} of ${total} correct`));
  root.appendChild(el('p', 'note', 'Another video unlocked!'));

  const button = el('button', 'primary-button', 'Back to videos');
  button.addEventListener('click', returnToYoutubeKids);
  root.appendChild(button);

  window.setTimeout(returnToYoutubeKids, SUCCESS_SCREEN_MS);
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
  if (!root) return;
  root.replaceChildren();

  root.appendChild(el('h1', 'prompt', 'Parent controls'));
  const list = el('div', 'options');

  const actions: Array<[string, string]> = [
    ['Skip this challenge', 'parentSkip'],
    [`Unlock for ${CONFIG.parent.timedUnlockMinutes} minutes`, 'parentTimedUnlock'],
    ['Turn off until Chrome restarts', 'parentDisableUntilRestart'],
  ];

  for (const [label, kind] of actions) {
    const button = el('button', 'option', label);
    // No self-navigation here: these all end in a non-silent releaseLock
    // effect, which moves the tab from the background the moment the state
    // machine processes the message. That is more reliable than this page
    // doing it, since it does not depend on this page's JS still running by
    // the time the message round-trip completes.
    button.addEventListener('click', () => void send(kind));
    list.appendChild(button);
  }

  const back = el('button', 'option', 'Back to the challenge');
  back.addEventListener('click', () => {
    void send('parentEndSession');
    void loadAndRenderQuestion();
  });
  list.appendChild(back);

  root.appendChild(list);
}

if (root) void loadAndRenderQuestion();

// No imports in this file, so this marks it a module rather than a global script.
export {};
