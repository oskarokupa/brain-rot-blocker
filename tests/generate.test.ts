import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/quiz/llm/apiKeyStore.js', () => ({ getApiKey: vi.fn() }));
vi.mock('../src/quiz/llm/anthropic.js', () => ({
  callStructured: vi.fn(),
  AnthropicError: class AnthropicError extends Error {
    kind: string;
    retryable: boolean;
    constructor(kind: string, message: string) {
      super(message);
      this.kind = kind;
      this.retryable = kind === 'rateLimit' || kind === 'server' || kind === 'timeout' || kind === 'network';
    }
  },
}));

import { getApiKey } from '../src/quiz/llm/apiKeyStore.js';
import { AnthropicError, callStructured } from '../src/quiz/llm/anthropic.js';
import { generateQuiz } from '../src/quiz/llm/generate.js';
import { validateQuizQuestions } from '../src/quiz/validate.js';
import type { GeneratedBundle } from '../src/quiz/llm/schema.js';

function singleItem(n: number) {
  return {
    prompt: `Question number ${n} about the video?`,
    options: ['First answer', 'Second answer', 'Third answer', 'Fourth answer'],
    correctIndex: n % 4,
    explanation: `Explanation for question ${n}.`,
  };
}

function validBundle(): GeneratedBundle {
  return {
    singleSelect: [singleItem(1), singleItem(2), singleItem(3)],
    multiSelect: {
      prompt: 'Which of these happened in the video?',
      options: ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'],
      correctIndices: [0, 2],
      explanation: 'A and C happened.',
    },
    typed: {
      prompt: 'Why did the character do that?',
      expectedConcept: 'She wanted to help her friend',
      keywords: ['help', 'friend'],
      exampleAnswers: ['She wanted to help her friend', 'To help a friend', 'Because her friend needed help'],
      explanation: 'She wanted to help her friend.',
      fallbackOptions: ['To help a friend', 'To win a prize', 'To get home faster', 'To avoid trouble'],
      fallbackCorrectIndex: 0,
    },
    spares: [singleItem(4), singleItem(5)],
    remediation: [
      { ...singleItem(6), difficulty: 1 },
      { ...singleItem(7), difficulty: 1 },
      { ...singleItem(8), difficulty: 2 },
      { ...singleItem(9), difficulty: 2 },
      { ...singleItem(10), difficulty: 2 },
      { ...singleItem(11), difficulty: 2 },
    ],
  };
}

const baseOptions = {
  videoId: 'vid1',
  durationSeconds: 400, // five-question band
  content: { transcriptText: 'A transcript about a friendly dragon.', metadata: null },
  recentQuestionIds: [],
  priorPromptsForVideo: [],
};

beforeEach(() => {
  vi.mocked(getApiKey).mockReset();
  vi.mocked(callStructured).mockReset();
});

describe('generateQuiz: falls back to the bank without attempting a network call', () => {
  it('when no API key is configured', async () => {
    vi.mocked(getApiKey).mockResolvedValue(null);
    const quiz = await generateQuiz(baseOptions);
    expect(quiz.source).toBe('fallback');
    expect(callStructured).not.toHaveBeenCalled();
  });

  it('when there is no transcript and no metadata to generate from', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    const quiz = await generateQuiz({ ...baseOptions, content: { transcriptText: null, metadata: null } });
    expect(quiz.source).toBe('fallback');
    expect(callStructured).not.toHaveBeenCalled();
  });
});

describe('generateQuiz: the successful path', () => {
  it('returns a transcript-sourced quiz built from the generated bundle', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue(validBundle());

    const quiz = await generateQuiz(baseOptions);
    expect(quiz.source).toBe('transcript');
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.spares).toHaveLength(2);
    expect(quiz.remediationPool).toHaveLength(6);
  });

  it('produces a quiz that passes full validation', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue(validBundle());

    const quiz = await generateQuiz(baseOptions);
    const result = validateQuizQuestions(quiz.questions, 5);
    expect(result.ok, result.problems.join('; ')).toBe(true);
  });

  it('trims to the shorter type mix for a short video without a second call', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue(validBundle());

    const quiz = await generateQuiz({ ...baseOptions, durationSeconds: 30 });
    expect(quiz.questions).toHaveLength(1);
    expect(callStructured).toHaveBeenCalledTimes(1);
  });

  it('uses metadata source when no transcript was available but metadata was', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue(validBundle());

    const quiz = await generateQuiz({
      ...baseOptions,
      content: { transcriptText: null, metadata: { title: 'A video', channel: null, description: null } },
    });
    expect(quiz.source).toBe('metadata');
  });

  it('carries the fallback multiple-choice question through onto the typed question', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockResolvedValue(validBundle());

    const quiz = await generateQuiz(baseOptions);
    const typed = quiz.questions.find((q) => q.type === 'typed');
    expect(typed?.type).toBe('typed');
    if (typed?.type === 'typed') {
      expect(typed.fallbackMultipleChoice.options).toEqual(validBundle().typed.fallbackOptions);
    }
  });
});

describe('generateQuiz: degrading on failure', () => {
  it('falls back to the bank when the API call throws', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockRejectedValue(new AnthropicError('server', 'HTTP 500'));

    const quiz = await generateQuiz(baseOptions);
    expect(quiz.source).toBe('fallback');
  });

  it('falls back to the bank on a timeout without retrying', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockRejectedValue(new AnthropicError('timeout', 'timed out'));

    const quiz = await generateQuiz(baseOptions);
    expect(quiz.source).toBe('fallback');
    expect(callStructured).toHaveBeenCalledTimes(1); // no point retrying the same input against the same timeout
  });

  it('retries once with the specific problems when the response fails validation', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    const broken = validBundle();
    broken.multiSelect.correctIndices = [0, 1, 2, 3, 4]; // every option correct: invalid

    vi.mocked(callStructured).mockResolvedValueOnce(broken).mockResolvedValueOnce(validBundle());

    const quiz = await generateQuiz(baseOptions);
    expect(quiz.source).toBe('transcript');
    expect(callStructured).toHaveBeenCalledTimes(2);

    const secondCallArgs = vi.mocked(callStructured).mock.calls[1]?.[0] as { system: string };
    expect(secondCallArgs.system).toContain('previous attempt had these problems');
  });

  it('falls back to the bank when every attempt fails validation', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    const broken = validBundle();
    broken.multiSelect.correctIndices = [0, 1, 2, 3, 4];
    vi.mocked(callStructured).mockResolvedValue(broken);

    const quiz = await generateQuiz(baseOptions);
    expect(quiz.source).toBe('fallback');
  });

  it('never throws out of generateQuiz itself, whatever the failure', async () => {
    vi.mocked(getApiKey).mockResolvedValue('key');
    vi.mocked(callStructured).mockRejectedValue(new Error('something unexpected'));
    await expect(generateQuiz(baseOptions)).resolves.toBeDefined();
  });
});
