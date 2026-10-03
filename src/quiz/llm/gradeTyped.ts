/**
 * The LLM tier of the typed-answer grading ladder: a binary judgment call
 * only reached once local matching (grade.ts) has already come back
 * uncertain. Returns null on anything short of a clean yes/no - no key, no
 * network, a timeout, a malformed response - so the caller's only job is
 * deciding what null means, never telling an error apart from a judgment.
 *
 * The timeout here is short enough to matter to her directly: this runs
 * while she is looking at a "Checking..." screen.
 */

import { CONFIG } from '../../config.js';
import { buildGradePrompt } from '../prompts.js';
import { getApiKey } from './apiKeyStore.js';
import { callStructured } from './anthropic.js';
import { GRADE_JSON_SCHEMA, type GradeVerdict } from './schema.js';

export async function gradeTypedWithLlm(
  expectedConcept: string,
  answer: string,
): Promise<boolean | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const prompt = buildGradePrompt(expectedConcept, answer);
  try {
    const verdict = await callStructured<GradeVerdict>({
      apiKey,
      system: prompt.system,
      user: prompt.user,
      jsonSchema: GRADE_JSON_SCHEMA,
      maxTokens: 64,
      timeoutMs: CONFIG.llm.typedGradeTimeoutMs,
    });
    return verdict.equivalent;
  } catch (err) {
    console.warn('[brb] typed-answer grading failed, falling back to multiple choice:', err);
    return null;
  }
}
