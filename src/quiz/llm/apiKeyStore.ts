/**
 * The Anthropic API key, entered once through the parent panel.
 *
 * Unlike the PIN, this cannot be hashed: the service worker has to read the
 * actual value back to put it on every generation and grading request. It
 * lives in chrome.storage.local like everything else here, never in the git
 * repo and never baked into the built bundle, so rotating or removing it
 * needs no rebuild.
 *
 * Reading and writing it both go through the service worker only. Neither
 * the YouTube Kids content script nor the challenge page ever sees this
 * value; they only see whether generation succeeded or fell back.
 */

const API_KEY_KEY = 'llmApiKey.v1';

export async function getApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get(API_KEY_KEY);
  const value = stored[API_KEY_KEY];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    await chrome.storage.local.remove(API_KEY_KEY);
    return;
  }
  await chrome.storage.local.set({ [API_KEY_KEY]: trimmed });
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null;
}

/** For the parent panel: enough to confirm a key is set without exposing it. */
export async function apiKeyHint(): Promise<string | null> {
  const key = await getApiKey();
  if (!key) return null;
  return key.length <= 8 ? '****' : `${key.slice(0, 7)}...${key.slice(-4)}`;
}
