import { describe, it, expect } from 'vitest';
import { GENERATION_JSON_SCHEMA, GRADE_JSON_SCHEMA } from '../src/quiz/llm/schema.js';

/**
 * Confirmed against a live 400 from the Anthropic API: output_config.format
 * rejects any array schema whose minItems is neither 0 nor 1. This walks the
 * whole schema tree so a future field added with minItems: 3 (an easy mistake
 * to reintroduce, since it reads as the obvious way to require an exact
 * count) fails here instead of as a live API error reachable only by someone
 * with a key testing against production.
 */
function findMinItemsViolations(node: unknown, path: string): string[] {
  if (node === null || typeof node !== 'object') return [];

  const violations: string[] = [];
  if ('minItems' in node) {
    const value = (node as { minItems: unknown }).minItems;
    if (typeof value === 'number' && value !== 0 && value !== 1) {
      violations.push(`${path}.minItems = ${value}`);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    violations.push(...findMinItemsViolations(value, `${path}.${key}`));
  }
  return violations;
}

describe('LLM request schemas never set minItems above 1', () => {
  it('GENERATION_JSON_SCHEMA', () => {
    const violations = findMinItemsViolations(GENERATION_JSON_SCHEMA, 'schema');
    expect(violations).toEqual([]);
  });

  it('GRADE_JSON_SCHEMA', () => {
    const violations = findMinItemsViolations(GRADE_JSON_SCHEMA, 'schema');
    expect(violations).toEqual([]);
  });
});
