import { describe, it, expect } from 'vitest';
import { GENERATION_JSON_SCHEMA, GRADE_JSON_SCHEMA } from '../src/quiz/llm/schema.js';

/**
 * Confirmed against two separate live 400s from the Anthropic API:
 * output_config.format rejects any array schema whose minItems is neither 0
 * nor 1, and rejects maxItems on an array outright regardless of its value -
 * an easy pair of mistakes to reintroduce later, since both read as the
 * obvious way to require an exact count. This walks the whole schema tree so
 * either fails here instead of as a live API error reachable only by someone
 * with a key testing against production.
 */
function findArrayLengthViolations(node: unknown, path: string): string[] {
  if (node === null || typeof node !== 'object') return [];

  const violations: string[] = [];
  if ('maxItems' in node) {
    violations.push(`${path}.maxItems = ${(node as { maxItems: unknown }).maxItems} (not supported at all)`);
  }
  if ('minItems' in node) {
    const value = (node as { minItems: unknown }).minItems;
    if (typeof value === 'number' && value !== 0 && value !== 1) {
      violations.push(`${path}.minItems = ${value} (only 0 or 1 is supported)`);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    violations.push(...findArrayLengthViolations(value, `${path}.${key}`));
  }
  return violations;
}

describe('LLM request schemas carry no unsupported array length constraint', () => {
  it('GENERATION_JSON_SCHEMA', () => {
    const violations = findArrayLengthViolations(GENERATION_JSON_SCHEMA, 'schema');
    expect(violations).toEqual([]);
  });

  it('GRADE_JSON_SCHEMA', () => {
    const violations = findArrayLengthViolations(GRADE_JSON_SCHEMA, 'schema');
    expect(violations).toEqual([]);
  });
});
