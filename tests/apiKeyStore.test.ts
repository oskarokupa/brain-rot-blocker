import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (key: string) => (key in store ? { [key]: store[key] } : {}),
      set: async (items: Record<string, unknown>) => void Object.assign(store, items),
      remove: async (key: string) => void delete store[key],
    },
  },
});

const { getApiKey, setApiKey, hasApiKey, apiKeyHint } = await import('../src/quiz/llm/apiKeyStore.js');

beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
});

describe('apiKeyStore', () => {
  it('has nothing set initially', async () => {
    expect(await getApiKey()).toBeNull();
    expect(await hasApiKey()).toBe(false);
    expect(await apiKeyHint()).toBeNull();
  });

  it('stores and retrieves a key', async () => {
    await setApiKey('sk-ant-abcdefghijklmnop');
    expect(await getApiKey()).toBe('sk-ant-abcdefghijklmnop');
    expect(await hasApiKey()).toBe(true);
  });

  it('trims surrounding whitespace', async () => {
    await setApiKey('  sk-ant-test  ');
    expect(await getApiKey()).toBe('sk-ant-test');
  });

  it('treats an empty or blank key as clearing it', async () => {
    await setApiKey('sk-ant-test');
    await setApiKey('   ');
    expect(await getApiKey()).toBeNull();
  });

  it('masks the hint rather than exposing the full key', async () => {
    await setApiKey('sk-ant-abcdefghijklmnop');
    const hint = await apiKeyHint();
    expect(hint).not.toContain('abcdefghijklmnop');
    expect(hint).toMatch(/^sk-ant-/);
  });

  it('replacing a key leaves no trace of the old one', async () => {
    await setApiKey('sk-ant-first-key-value');
    await setApiKey('sk-ant-second-key-value');
    expect(await getApiKey()).toBe('sk-ant-second-key-value');
  });
});
