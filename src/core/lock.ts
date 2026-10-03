/**
 * Lock enforcement.
 *
 * Three layers, because reacting to new tabs alone leaves obvious gaps:
 *
 *  1. New surfaces. A tab or window created while locked gets redirected.
 *  2. Existing surfaces. Everything already open is swept the moment the lock
 *     engages. Without this, a tab opened before the challenge was owed stays
 *     fully usable, which is the easiest bypass there is.
 *  3. Switching. Activating a tab or focusing a window re-checks, so a
 *     background tab cannot be parked and returned to.
 *
 * This is not OS-level security and is not trying to be. It stops casual
 * wandering, which is the actual threat model.
 */

const QUIZ_PATH = 'ui/quiz.html';

function quizUrl(): string {
  return chrome.runtime.getURL(QUIZ_PATH);
}

/**
 * Surfaces that stay reachable while locked. The options page and the Chrome
 * extensions page are on this list deliberately: they are how a parent gets in
 * when the challenge screen itself is broken, so redirecting them would remove
 * the last way out.
 */
function isAllowed(url: string | undefined): boolean {
  if (!url) return true; // A tab with no URL yet is handled on its next update.
  if (url.startsWith(chrome.runtime.getURL(''))) return true;
  if (url.startsWith('chrome://extensions')) return true;
  if (url === 'about:blank') return true;
  return false;
}

async function redirect(tabId: number, url: string | undefined): Promise<void> {
  if (isAllowed(url)) return;
  try {
    await chrome.tabs.update(tabId, { url: quizUrl() });
  } catch {
    // The tab may have closed between the event and this call. Nothing to do.
  }
}

/* ------------------------------------------------------------------ *
 * Listeners
 * ------------------------------------------------------------------ */

type LockQuery = () => Promise<boolean>;

let isLockedNow: LockQuery = async () => false;
let listenersAttached = false;

async function guard(tabId: number, url: string | undefined): Promise<void> {
  if (!(await isLockedNow())) return;
  await redirect(tabId, url);
}

function onTabCreated(tab: chrome.tabs.Tab): void {
  if (tab.id === undefined) return;
  // A brand new tab often has no URL yet, so onUpdated does the real work.
  void guard(tab.id, tab.pendingUrl ?? tab.url);
}

function onTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): void {
  if (!changeInfo.url && changeInfo.status !== 'loading') return;
  void guard(tabId, changeInfo.url ?? tab.url);
}

function onTabActivated(info: chrome.tabs.TabActiveInfo): void {
  chrome.tabs
    .get(info.tabId)
    .then((tab) => guard(info.tabId, tab.url))
    .catch(() => undefined);
}

function onWindowFocusChanged(windowId: number): void {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  void sweepIfLocked();
}

function onWindowCreated(): void {
  void sweepIfLocked();
}

/** Attach once. Listeners stay attached and check the lock state themselves. */
export function attachLockListeners(query: LockQuery): void {
  isLockedNow = query;
  if (listenersAttached) return;
  listenersAttached = true;

  chrome.tabs.onCreated.addListener(onTabCreated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.tabs.onActivated.addListener(onTabActivated);
  chrome.windows.onCreated.addListener(onWindowCreated);
  chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);
}

/* ------------------------------------------------------------------ *
 * Sweeping
 * ------------------------------------------------------------------ */

/**
 * Redirect everything already open. Called when the lock engages and again on
 * window focus, because a tab that existed beforehand is otherwise untouched.
 */
export async function sweepAllTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) => (tab.id === undefined ? undefined : redirect(tab.id, tab.url))),
  );
}

async function sweepIfLocked(): Promise<void> {
  if (await isLockedNow()) await sweepAllTabs();
}

/* ------------------------------------------------------------------ *
 * Presenting and releasing
 * ------------------------------------------------------------------ */

/**
 * Put the challenge in front of her. Reuses an open quiz tab rather than
 * stacking new ones, and falls back to creating a window if there is no tab
 * to take over, which is what happens after a cold start.
 */
export async function presentQuiz(): Promise<void> {
  const url = quizUrl();
  const existing = await chrome.tabs.query({ url: `${url}*` });
  if (existing.length > 0 && existing[0]?.id !== undefined) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true }).catch(() => undefined);
    }
    await sweepAllTabs();
    return;
  }

  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  const target = active[0];
  if (target?.id !== undefined) await chrome.tabs.update(target.id, { url });
  else await chrome.tabs.create({ url });

  await sweepAllTabs();
}

/**
 * The forced recovery path. Used for every release except a genuine pass: a
 * parent action, a fault, or a watchdog timeout. None of those can be trusted
 * to have a working page ready to leave on its own, so this moves the tab
 * immediately rather than waiting on one. A pass is the one exception,
 * because the challenge's own success screen is already on its way and this
 * would otherwise cut it off before she sees it; see the `silent` flag on the
 * `releaseLock` effect in core/stateMachine.ts.
 */
export async function forceReturnToYoutubeKids(): Promise<void> {
  const url = quizUrl();
  const quizTabs = await chrome.tabs.query({ url: `${url}*` });
  await Promise.all(
    quizTabs.map((tab) =>
      tab.id === undefined
        ? undefined
        : chrome.tabs
            .update(tab.id, { url: 'https://www.youtubekids.com/' })
            .catch(() => undefined),
    ),
  );
}

/** Best effort pause of whatever is playing on the YouTube Kids tabs. */
export async function pausePlayback(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: '*://*.youtubekids.com/*' });
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined
        ? undefined
        : chrome.tabs.sendMessage(tab.id, { kind: 'pausePlayback' }).catch(() => undefined),
    ),
  );
}
