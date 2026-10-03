import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicError, callStructured } from '../src/quiz/llm/anthropic.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function messageResponse(text: string): Response {
  return jsonResponse(200, { content: [{ type: 'text', text }] });
}

const baseOptions = {
  apiKey: 'test-key',
  system: 'system prompt',
  user: 'user prompt',
  jsonSchema: { type: 'object' as const },
  maxTokens: 100,
  timeoutMs: 1000,
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('callStructured: the happy path', () => {
  it('parses the text block as JSON and returns it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(messageResponse('{"ok":true}')));
    const result = await callStructured<{ ok: boolean }>(baseOptions);
    expect(result).toEqual({ ok: true });
  });

  it('sends the schema under output_config.format as json_schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(messageResponse('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await callStructured(baseOptions);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.output_config.format).toEqual({ type: 'json_schema', schema: baseOptions.jsonSchema });
  });

  it('sends the required authentication and version headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(messageResponse('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await callStructured(baseOptions);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['content-type']).toBe('application/json');
  });

  it('finds the text block even when it is not the first content block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"ok":true}' }],
        }),
      ),
    );
    const result = await callStructured<{ ok: boolean }>(baseOptions);
    expect(result).toEqual({ ok: true });
  });
});

describe('callStructured: HTTP error classification', () => {
  it.each([
    [400, 'badRequest', false],
    [401, 'authentication', false],
    [403, 'badRequest', false],
    [404, 'badRequest', false],
    [429, 'rateLimit', true],
    [500, 'server', true],
    [529, 'server', true],
  ] as const)('maps HTTP %i to kind %s (retryable: %s)', async (status, kind, retryable) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(status, { error: { type: 'some_error', message: 'x' } })),
    );
    await expect(callStructured(baseOptions)).rejects.toMatchObject({
      name: 'AnthropicError',
      kind,
      retryable,
    });
  });

  it('includes the response body\'s error type and message, not just the status', async () => {
    // The actual case that prompted this: a 400 alone ("badRequest") gives no
    // way to tell a rejected header apart from a multi-workspace key missing
    // anthropic-workspace-id. The body is where that distinction lives.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, { error: { type: 'invalid_request_error', message: 'workspace_id is required' } }),
      ),
    );
    await expect(callStructured(baseOptions)).rejects.toMatchObject({
      kind: 'badRequest',
      message: expect.stringContaining('workspace_id is required'),
    });
  });

  it('still reports status and kind when the error body cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 400 })));
    await expect(callStructured(baseOptions)).rejects.toMatchObject({
      kind: 'badRequest',
      message: expect.stringContaining('HTTP 400'),
    });
  });
});

describe('callStructured: malformed responses', () => {
  it('rejects when the response body is not JSON at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    await expect(callStructured(baseOptions)).rejects.toMatchObject({ kind: 'malformedResponse' });
  });

  it('rejects when there is no text content block', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { content: [{ type: 'tool_use' }] })));
    await expect(callStructured(baseOptions)).rejects.toMatchObject({ kind: 'malformedResponse' });
  });

  it('rejects when the text block is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(messageResponse('not actually json')));
    await expect(callStructured(baseOptions)).rejects.toMatchObject({ kind: 'malformedResponse' });
  });
});

describe('callStructured: timeouts and network failures', () => {
  it('reports a timeout distinctly from a generic network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }),
    );
    await expect(callStructured({ ...baseOptions, timeoutMs: 10 })).rejects.toMatchObject({
      kind: 'timeout',
      retryable: true,
    });
  });

  it('reports a plain connection failure as network, not timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(callStructured(baseOptions)).rejects.toMatchObject({ kind: 'network', retryable: true });
  });
});

describe('AnthropicError retryability', () => {
  it('marks auth and bad-request errors as not retryable', () => {
    expect(new AnthropicError('authentication', 'x').retryable).toBe(false);
    expect(new AnthropicError('badRequest', 'x').retryable).toBe(false);
    expect(new AnthropicError('malformedResponse', 'x').retryable).toBe(false);
  });

  it('marks transient errors as retryable', () => {
    expect(new AnthropicError('rateLimit', 'x').retryable).toBe(true);
    expect(new AnthropicError('server', 'x').retryable).toBe(true);
    expect(new AnthropicError('timeout', 'x').retryable).toBe(true);
    expect(new AnthropicError('network', 'x').retryable).toBe(true);
  });
});
