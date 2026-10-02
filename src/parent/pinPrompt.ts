/**
 * The PIN prompt, shared by the options page and the challenge overlay.
 *
 * It owns no state beyond what is on screen. Verification happens in the
 * service worker, so this never sees the stored hash and cannot leak it.
 */

export interface PinPromptOptions {
  /** Shown above the keypad. */
  title: string;
  /** Called after the worker confirms the PIN. */
  onSuccess: () => void;
  onCancel?: () => void;
  /** Collect a new PIN instead of checking an existing one. */
  mode?: 'verify' | 'set';
  pinLength?: number;
}

interface VerifyReply {
  ok: boolean;
  value?: { ok: boolean; lockedUntil?: number; attemptsLeft?: number };
}

const DEFAULT_LENGTH = 4;

function send<T>(kind: string, extra: Record<string, unknown> = {}): Promise<T | undefined> {
  return chrome.runtime.sendMessage({ kind, ...extra }).catch(() => undefined) as Promise<
    T | undefined
  >;
}

export function openPinPrompt(options: PinPromptOptions): HTMLElement {
  const length = options.pinLength ?? DEFAULT_LENGTH;
  const mode = options.mode ?? 'verify';

  const overlay = document.createElement('div');
  overlay.className = 'pin-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const panel = document.createElement('div');
  panel.className = 'pin-panel';

  const heading = document.createElement('h2');
  heading.className = 'pin-title';
  heading.textContent = options.title;

  const dots = document.createElement('div');
  dots.className = 'pin-dots';

  const message = document.createElement('p');
  message.className = 'pin-message';

  const keypad = document.createElement('div');
  keypad.className = 'pin-keypad';

  const cancel = document.createElement('button');
  cancel.className = 'pin-cancel';
  cancel.textContent = 'Cancel';

  let entry = '';
  let lockedUntil = 0;
  let countdown: ReturnType<typeof setInterval> | null = null;

  function renderDots(): void {
    dots.replaceChildren();
    for (let i = 0; i < length; i++) {
      const dot = document.createElement('span');
      dot.className = i < entry.length ? 'pin-dot filled' : 'pin-dot';
      dots.appendChild(dot);
    }
  }

  function setLockedMessage(): void {
    const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    if (left === 0) {
      if (countdown) clearInterval(countdown);
      countdown = null;
      message.textContent = '';
      setDisabled(false);
      return;
    }
    message.textContent = `Too many attempts. Try again in ${left}s.`;
  }

  function setDisabled(disabled: boolean): void {
    for (const button of keypad.querySelectorAll('button')) {
      (button as HTMLButtonElement).disabled = disabled;
    }
  }

  async function submit(): Promise<void> {
    if (mode === 'set') {
      const reply = await send<{ ok: boolean; value?: { ok?: boolean; invalid?: boolean } }>(
        'parentSetPin',
        { pin: entry },
      );
      if (reply?.value?.ok) {
        close();
        options.onSuccess();
        return;
      }
      message.textContent = reply?.value?.invalid
        ? `Use exactly ${length} digits.`
        : 'Could not set that PIN.';
      entry = '';
      renderDots();
      return;
    }

    const reply = await send<VerifyReply>('parentVerifyPin', { pin: entry });
    const result = reply?.value;
    if (result?.ok) {
      close();
      options.onSuccess();
      return;
    }

    entry = '';
    renderDots();

    if (result?.lockedUntil) {
      lockedUntil = result.lockedUntil;
      setDisabled(true);
      setLockedMessage();
      if (!countdown) countdown = setInterval(setLockedMessage, 500);
      return;
    }
    message.textContent =
      result?.attemptsLeft !== undefined
        ? `Not quite. ${result.attemptsLeft} attempts left.`
        : 'Not quite.';
  }

  function press(digit: string): void {
    if (entry.length >= length) return;
    entry += digit;
    message.textContent = '';
    renderDots();
    if (entry.length === length) void submit();
  }

  function backspace(): void {
    entry = entry.slice(0, -1);
    renderDots();
  }

  function close(): void {
    if (countdown) clearInterval(countdown);
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  function onKey(event: KeyboardEvent): void {
    if (Date.now() < lockedUntil) return;
    if (/^\d$/.test(event.key)) press(event.key);
    else if (event.key === 'Backspace') backspace();
    else if (event.key === 'Escape') {
      close();
      options.onCancel?.();
    }
  }

  for (const label of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '<']) {
    if (label === '') {
      keypad.appendChild(document.createElement('span'));
      continue;
    }
    const button = document.createElement('button');
    button.className = 'pin-key';
    button.textContent = label;
    button.addEventListener('click', () => (label === '<' ? backspace() : press(label)));
    keypad.appendChild(button);
  }

  cancel.addEventListener('click', () => {
    close();
    options.onCancel?.();
  });

  renderDots();
  panel.append(heading, dots, message, keypad, cancel);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);

  return overlay;
}
