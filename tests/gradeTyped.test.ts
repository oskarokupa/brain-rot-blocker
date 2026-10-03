import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/quiz/llm/apiKeyStore.js', () => ({ getApiKey: vi.fn() }));
vi.mock('../src/quiz/llm/anthropic.js', () => ({ callStructured: vi.fn() }));

import { getApiKey } from '../src/quiz/llm/apiKeyStore.js';
import { callStructured } from '../src/quiz/llm/anthropic.js';
import { gradeTypedWithLlm } from '../src/quiz/llm/gradeTyped.js';

beforeEach(() => {
  vi.mocked(getApiKey).mockReset();
  vi.mocked(callStructured).mockReset();
});

describe('gradeTypedWithLlm', () => {
  it('returns null without attempting a call when no key is configured', async () => {
    vi.mocked(getApiKey).mockResolvedValue(null);
    const result = await gradeTypedWithLlm('concept', 'answer');
    expect(result).toBeNull();
    expect(callStructured).not.toHaveBeenCalled();
  });

  it('returns true when the model judges the answer equivalent', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue({ equivalent: true });
    expect(await gradeTypedWithLlm('concept', 'answer')).toBe(true);
  });

  it('returns false when the model judges the answer not equivalent', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue({ equivalent: false });
    expect(await gradeTypedWithLlm('concept', 'answer')).toBe(false);
  });

  it('returns null, not a thrown error, when the call fails or times out', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockRejectedValue(new Error('timeout'));
    await expect(gradeTypedWithLlm('concept', 'answer')).resolves.toBeNull();
  });
});
