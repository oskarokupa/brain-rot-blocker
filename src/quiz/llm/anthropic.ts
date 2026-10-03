/**
 * A minimal Anthropic Messages API client, built on raw fetch rather than
 * @anthropic-ai/sdk.
 *
 * That is a deliberate departure from the usual default of reaching for the
 * official SDK. Three reasons, specific to this codebase rather than a
 * general preference: the project's own spec calls for avoiding dependencies
 * beyond esbuild, TypeScript and vitest; an MV3 service worker is not among
 * the SDK's documented supported runtimes (Node, Deno, Bun, Cloudflare
 * Workers, Vercel Edge, browsers behind an explicit flag - no `window`
 * global the way every one of those has some equivalent of); and the only
 * two calls this extension ever makes are a single structured generation and
 * a single binary classification, nowhere near needing the batches, files,
 * MCP or tool-runner surface the full SDK bundles.
 *
 * Calling the API directly from a browser-class context needs
 * `dangerouslyAllowBrowser: true` on the SDK; the raw equivalent is simply
 * sending the request. Anthropic's own docs name exactly this project's
 * shape - "internal tools... used solely within a controlled environment
 * where the users are trusted" - as the case where that is an accepted
 * trade, which matches a single parent's own key in their own unpublished
 * extension.
 */

import { CONFIG } from '../../config.js';

export type AnthropicErrorKind =
  | 'noApiKey'
  | 'authentication'
  | 'badRequest'
  | 'rateLimit'
  | 'server'
  | 'timeout'
  | 'network'
  | 'malformedResponse';

export class AnthropicError extends Error {
  readonly kind: AnthropicErrorKind;
  readonly retryable: boolean;

  constructor(kind: AnthropicErrorKind, message: string) {
    super(message);
    this.name = 'AnthropicError';
    this.kind = kind;
    // Matches the documented status-code table: 429/5xx are transient and
    // worth a single retry elsewhere; everything else (bad key, bad request,
    // a schema the model simply could not satisfy) will not improve by
    // asking again with the same input.
    this.retryable = kind === 'rateLimit' || kind === 'server' || kind === 'timeout' || kind === 'network';
  }
}

/** Classifies an HTTP error response the way the documented table does. */
function classifyStatus(status: number): AnthropicErrorKind {
  if (status === 401) return 'authentication';
  if (status === 429) return 'rateLimit';
  if (status >= 500) return 'server';
  return 'badRequest'; // 400, 402, 403, 404, 413, and anything else non-2xx.
}

interface CallOptions {
  apiKey: string;
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  timeoutMs: number;
}

/**
 * One structured call. Returns the parsed JSON object the schema constrained
 * the response to, or throws an AnthropicError classifying why it could not.
 *
 * No retry lives here: a timeout, a rate limit, and a response that fails our
 * own validate.ts all need different handling by the caller (one retry with a
 * corrective prompt, versus falling straight to the next tier down), so this
 * function does exactly one attempt and reports what happened.
 */
export async function callStructured<T>(options: CallOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  let response: Response;
  try {
    response = await fetch(CONFIG.llm.apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': CONFIG.llm.apiVersion,
        // Not confirmed necessary against current docs (which list only
        // x-api-key / anthropic-version / content-type as required), but
        // harmless to include and was historically how the API recognised a
        // request originating from a browser-class fetch. If requests ever
        // fail specifically with a browser/origin-shaped rejection, this is
        // the first thing to double check against a live call.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CONFIG.llm.model,
        max_tokens: options.maxTokens,
        system: options.system,
        messages: [{ role: 'user', content: options.user }],
        output_config: {
          format: { type: 'json_schema', schema: options.jsonSchema },
        },
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new AnthropicError('timeout', `request did not complete within ${options.timeoutMs}ms`);
    }
    throw new AnthropicError('network', String(err));
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const kind = classifyStatus(response.status);
    // The body carries the actual reason (invalid key, missing workspace id
    // on a multi-workspace key, a malformed field) and is the difference
    // between "something is wrong" and knowing what to fix. Best effort:
    // reading it can itself fail, and that must not hide the original error.
    let detail = '';
    try {
      const body = (await response.json()) as { error?: { type?: string; message?: string } };
      if (body?.error) detail = ` - ${body.error.type ?? ''}: ${body.error.message ?? ''}`;
    } catch {
      // No usable body. The status and kind are still reported below.
    }
    throw new AnthropicError(kind, `HTTP ${response.status}${detail}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    throw new AnthropicError('malformedResponse', `response was not valid JSON: ${String(err)}`);
  }

  const textBlock = extractTextBlock(body);
  if (textBlock === null) {
    throw new AnthropicError('malformedResponse', 'no text content block in response');
  }

  try {
    return JSON.parse(textBlock) as T;
  } catch (err) {
    // output_config.format guarantees schema-valid JSON on success, but a
    // response that stopped early (hit max_tokens, or was refused) can still
    // reach here with a block that is not valid JSON at all.
    throw new AnthropicError('malformedResponse', `text block was not valid JSON: ${String(err)}`);
  }
}

interface MessageContentBlock {
  type: string;
  text?: string;
}

function extractTextBlock(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  const block = content.find(
    (b): b is MessageContentBlock => typeof b === 'object' && b !== null && (b as MessageContentBlock).type === 'text',
  );
  return typeof block?.text === 'string' ? block.text : null;
}
