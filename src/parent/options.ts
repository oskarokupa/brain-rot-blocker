/**
 * Parent panel and recovery surface.
 *
 * This page is reachable from chrome://extensions even when everything else is
 * broken, and the lock enforcer deliberately allowlists it. That makes it the
 * last way out, so it stays plain: no framework, no build-time cleverness, and
 * an unlock control that works regardless of what state the extension is in.
 *
 * The PIN gate arrives in phase 7. Until then the unlock control is open,
 * which is the right trade while the lock itself is still being proven.
 */

import { openPinPrompt } from './pinPrompt.js';

interface VideoDiagnostic {
  videoId: string;
  title: string | null;
  durationSeconds: number | null;
  transcriptCaptured: boolean;
  transcriptLanguage: string | null;
  transcriptIsAutomatic: boolean | null;
  cueCount: number;
  coverage: number;
  unavailableReason: string | null;
  ended: boolean;
}

interface PersistedState {
  phase: string;
  owedVideoId: string | null;
  owedReason: string | null;
  carryOverSeconds: number;
  activeWatchedSeconds: number;
  remediationRound: number;
  parentUnlockExpiresAt: number | null;
  lockEngaged: boolean;
}

const DIAG_KEY = 'diagnostics.v1';

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '?';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Reply<T> {
  ok: boolean;
  value?: T;
}

async function send<T>(kind: string, extra: Record<string, unknown> = {}): Promise<Reply<T> | undefined> {
  return chrome.runtime.sendMessage({ kind, ...extra }).catch(() => undefined) as Promise<Reply<T> | undefined>;
}

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

const LOCKED_PHASES = ['quizLocked', 'remediationLocked'];

function renderStatus(state: PersistedState | null): string {
  if (!state) return '<p class="muted">State unavailable.</p>';

  const locked = LOCKED_PHASES.includes(state.phase);
  const unlockLeft =
    state.parentUnlockExpiresAt && state.parentUnlockExpiresAt > Date.now()
      ? Math.ceil((state.parentUnlockExpiresAt - Date.now()) / 60_000)
      : null;

  const bits = [
    `<span class="pill ${locked ? 'locked' : 'open'}">${locked ? 'Locked' : 'Not locked'}</span>`,
    `<span class="muted">phase: ${escapeHtml(state.phase)}</span>`,
  ];
  if (state.owedVideoId) {
    bits.push(
      `<span class="muted">challenge owed for ${escapeHtml(state.owedVideoId)} (${escapeHtml(state.owedReason ?? '')})</span>`,
    );
  }
  if (state.remediationRound > 0) {
    bits.push(`<span class="muted">remediation round ${state.remediationRound}</span>`);
  }
  if (unlockLeft !== null) {
    bits.push(`<span class="muted">timed unlock, ${unlockLeft} min left</span>`);
  }
  bits.push(
    `<span class="muted">carry-over ${Math.round(state.carryOverSeconds)}s, this video ${Math.round(state.activeWatchedSeconds)}s</span>`,
  );
  return bits.join(' ');
}

/* ------------------------------------------------------------------ *
 * Diagnostics
 * ------------------------------------------------------------------ */

function renderStats(rows: VideoDiagnostic[]): string {
  const total = rows.length;
  const captured = rows.filter((r) => r.transcriptCaptured).length;
  const manual = rows.filter((r) => r.transcriptCaptured && r.transcriptIsAutomatic === false).length;
  const ended = rows.filter((r) => r.ended).length;
  const rate = total ? Math.round((captured / total) * 100) : 0;

  const stat = (value: string, label: string) =>
    `<div class="stat"><b>${value}</b><span>${label}</span></div>`;

  return [
    stat(String(total), 'videos seen'),
    stat(`${captured}/${total}`, `transcripts captured (${rate}%)`),
    stat(String(manual), 'human authored'),
    stat(String(ended), 'end detected'),
  ].join('');
}

function renderTable(rows: VideoDiagnostic[]): string {
  if (rows.length === 0) {
    return '<tr><td class="muted">Nothing recorded yet. Play a video on youtubekids.com.</td></tr>';
  }
  const head =
    '<tr><th>Video</th><th>Length</th><th>Transcript</th><th>Lang</th><th>Cues</th><th>Coverage</th><th>End</th></tr>';
  const body = rows
    .map((r) => {
      const transcript = r.transcriptCaptured
        ? `<span class="yes">yes</span>${r.transcriptIsAutomatic ? ' <span class="muted">(auto)</span>' : ''}`
        : `<span class="no">no</span> <span class="muted">${escapeHtml(r.unavailableReason ?? '')}</span>`;
      return `<tr>
        <td>${r.title ? escapeHtml(r.title) : `<span class="muted">${escapeHtml(r.videoId)}</span>`}</td>
        <td>${formatDuration(r.durationSeconds)}</td>
        <td>${transcript}</td>
        <td>${escapeHtml(r.transcriptLanguage ?? '-')}</td>
        <td>${r.cueCount || '-'}</td>
        <td>${r.transcriptCaptured ? Math.round(r.coverage * 100) + '%' : '-'}</td>
        <td>${r.ended ? '<span class="yes">yes</span>' : '<span class="muted">no</span>'}</td>
      </tr>`;
    })
    .join('');
  return head + body;
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

async function render(): Promise<void> {
  const [stored, stateReply] = await Promise.all([
    chrome.storage.local.get(DIAG_KEY),
    send<PersistedState>('getState'),
  ]);
  const rows = Object.values((stored[DIAG_KEY] ?? {}) as Record<string, VideoDiagnostic>);
  const state: PersistedState | null = stateReply?.ok ? (stateReply.value ?? null) : null;

  document.getElementById('status')!.innerHTML = renderStatus(state);
  document.getElementById('stats')!.innerHTML = renderStats(rows);
  document.getElementById('table')!.innerHTML = renderTable(rows);
}

/** Runs `action` once a PIN session is open, prompting first if one is needed. */
async function withParentAuth(title: string, action: () => Promise<void>): Promise<void> {
  const reply = await send<boolean>('parentHasPin');
  if (reply?.value !== true) {
    // No PIN set yet. Act, then nudge towards setting one.
    await action();
    void render();
    showPinHint();
    return;
  }
  openPinPrompt({
    title,
    onSuccess: () => {
      void action().then(() => render());
    },
  });
}

function showPinHint(): void {
  const hint = document.getElementById('pin-state');
  if (hint) hint.textContent = 'No PIN set. Anyone can unlock. Set one below.';
}

document.getElementById('unlock')!.addEventListener('click', () => {
  void withParentAuth('Parent access', async () => {
    await send('clearLock');
  });
});

document.getElementById('timed-unlock')!.addEventListener('click', () => {
  void withParentAuth('Parent access', async () => {
    await send('parentTimedUnlock');
  });
});

document.getElementById('set-pin')!.addEventListener('click', async () => {
  const reply = await send<boolean>('parentHasPin');
  const exists = reply?.value === true;
  const open = () =>
    openPinPrompt({
      mode: 'set',
      title: exists ? 'Choose a new PIN' : 'Set a 4-digit PIN',
      onSuccess: () => void refreshPinState(),
    });
  // Changing an existing PIN requires the current one.
  if (exists) openPinPrompt({ title: 'Enter current PIN', onSuccess: open });
  else open();
});

async function refreshPinState(): Promise<void> {
  const reply = await send<boolean>('parentHasPin');
  const hint = document.getElementById('pin-state');
  if (!hint) return;
  hint.textContent =
    reply?.value === true
      ? 'A PIN is set. Parent controls ask for it.'
      : 'No PIN set. Anyone can unlock. Set one now.';
}

interface ApiKeyStatus {
  set: boolean;
  hint: string | null;
}

async function refreshApiKeyState(): Promise<void> {
  const reply = await send<ApiKeyStatus>('parentGetApiKeyStatus');
  const el = document.getElementById('api-key-state');
  if (!el) return;
  el.textContent = reply?.value?.set
    ? `A key is set (${reply.value.hint}). Saving a new one replaces it.`
    : 'No key set. Challenges use the offline question bank.';
}

document.getElementById('save-api-key')!.addEventListener('click', async () => {
  const input = document.getElementById('api-key-input') as HTMLInputElement;
  const key = input.value.trim();
  if (key.length === 0) return;

  await withParentAuth('Parent access', async () => {
    await send('parentSetApiKey', { key });
  });
  input.value = '';
  void refreshApiKeyState();
});

document.getElementById('clear')!.addEventListener('click', async () => {
  await send('clearDiagnostics');
  void render();
});

chrome.storage.onChanged.addListener(() => void render());
setInterval(() => void render(), 5000);
void render();
void refreshApiKeyState();
void refreshPinState();

// No imports in this file, so this marks it a module rather than a global script.
export {};
