/**
 * The challenge surface.
 *
 * Phase 2 scope: a working dummy challenge. The questions are hard-coded
 * placeholders, because the point right now is to exercise every lock
 * transition end to end, not to ask anything meaningful. The real engine
 * arrives in phase 4 and the native YouTube Kids styling in phase 8.
 *
 * One behaviour here is not a placeholder. This page must report that it
 * rendered. If the heartbeat never arrives, the worker's watchdog releases the
 * lock, because a challenge screen that cannot draw itself is a lockout rather
 * than a challenge.
 */

import { CONFIG } from '../config.js';
import { openPinPrompt } from '../parent/pinPrompt.js';

interface DummyQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
}

const DUMMY: DummyQuestion[] = [
  {
    prompt: 'Placeholder question: which of these is a planet?',
    options: ['Saturn', 'Orion', 'Andromeda'],
    correctIndex: 0,
  },
  {
    prompt: 'Placeholder question: what do plants use to make food?',
    options: ['Moonlight', 'Sunlight', 'Starlight'],
    correctIndex: 1,
  },
  {
    prompt: 'Placeholder question: which is the largest ocean?',
    options: ['Atlantic', 'Indian', 'Pacific'],
    correctIndex: 2,
  },
];

const root = document.getElementById('root');

function send(kind: string, extra: Record<string, unknown> = {}): Promise<unknown> {
  return chrome.runtime.sendMessage({ kind, ...extra }).catch(() => undefined);
}

// Any uncaught error during render has to reach the worker, otherwise the
// watchdog is the only thing standing between a bug and a locked computer.
window.addEventListener('error', (event) => {
  void send('quizRenderFailed', { reason: String(event.message) });
});
window.addEventListener('unhandledrejection', (event) => {
  void send('quizRenderFailed', { reason: String(event.reason) });
});

let index = 0;
let correct = 0;

function render(): void {
  if (!root) return;
  const question = DUMMY[index];
  if (!question) return;

  root.replaceChildren();

  const dots = document.createElement('div');
  dots.className = 'dots';
  DUMMY.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = i < index ? 'dot done' : i === index ? 'dot current' : 'dot';
    dots.appendChild(dot);
  });
  attachParentGesture(dots);

  const counter = document.createElement('p');
  counter.className = 'counter';
  counter.textContent = `Question ${index + 1} of ${DUMMY.length}`;

  const prompt = document.createElement('h1');
  prompt.className = 'prompt';
  prompt.textContent = question.prompt;

  const list = document.createElement('div');
  list.className = 'options';
  question.options.forEach((label, i) => {
    const button = document.createElement('button');
    button.className = 'option';
    button.textContent = label;
    button.addEventListener('click', () => answer(i === question.correctIndex));
    list.appendChild(button);
  });

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = 'Placeholder questions. The real challenge engine lands in phase 4.';

  root.append(dots, counter, prompt, list, note);
}

/**
 * The hidden parent gesture. A long press on the progress dots opens the PIN
 * prompt. Nothing on screen advertises it, but the dots are a real press
 * target so a parent who knows can always reach it, including mid-challenge.
 */
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
  // Stop the press turning into a text selection on a trackpad.
  target.addEventListener('contextmenu', (e) => e.preventDefault());
}

function openParentPanel(): void {
  openPinPrompt({
    title: 'Parent access',
    onSuccess: showParentActions,
  });
}

function showParentActions(): void {
  if (!root) return;
  root.replaceChildren();

  const heading = document.createElement('h1');
  heading.className = 'prompt';
  heading.textContent = 'Parent controls';

  const list = document.createElement('div');
  list.className = 'options';

  const actions: Array<[string, string]> = [
    ['Skip this challenge', 'parentSkip'],
    [`Unlock for ${CONFIG.parent.timedUnlockMinutes} minutes`, 'parentTimedUnlock'],
    ['Turn off until Chrome restarts', 'parentDisableUntilRestart'],
  ];

  for (const [label, kind] of actions) {
    const button = document.createElement('button');
    button.className = 'option';
    button.textContent = label;
    button.addEventListener('click', () => void send(kind));
    list.appendChild(button);
  }

  const back = document.createElement('button');
  back.className = 'option';
  back.textContent = 'Back to the challenge';
  back.addEventListener('click', () => {
    void send('parentEndSession');
    render();
  });
  list.appendChild(back);

  root.append(heading, list);
}

function answer(wasCorrect: boolean): void {
  if (wasCorrect) correct++;
  index++;
  if (index < DUMMY.length) {
    render();
    return;
  }
  finish();
}

function finish(): void {
  if (!root) return;
  const passed = correct >= DUMMY.length; // Dummy rule: all of them.

  root.replaceChildren();
  const heading = document.createElement('h1');
  heading.className = 'prompt';
  heading.textContent = passed ? 'Challenge cleared.' : 'Close. One more round.';
  const detail = document.createElement('p');
  detail.className = 'counter';
  detail.textContent = `${correct} of ${DUMMY.length} correct`;
  root.append(heading, detail);

  void send(passed ? 'quizPassed' : 'quizFailed');
}

if (root) {
  render();
  void send('quizReady');
}

// No imports in this file, so this marks it a module rather than a global script.
export {};
