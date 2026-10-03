import { describe, it, expect } from 'vitest';
import { GENERATION_JSON_SCHEMA, GRADE_JSON_SCHEMA } from '../src/quiz/llm/schema.js';

/**
 * Confirmed against three separate live 400s from the Anthropic API, in
 * order: output_config.format rejects any array schema whose minItems is
 * neither 0 nor 1; rejects maxItems on an array outright regardless of its
 * value; and rejects minimum/maximum outright on type: integer (confirmed
 * separately that type: number accepts minimum/maximum fine, and that
 * type: integer with enum works, so enum is the correct replacement, not an
 * accident of this particular schema). All three read as the obvious way to
 * bound a value, which is exactly why they are easy to reintroduce later.
 * This walks the whole schema tree so any of them fails here instead of as a
 * live API error reachable only by someone with a key testing in production.
 */
function findUnsupportedConstraints(node: unknown, path: string): string[] {
  if (node === null || typeof node !== 'object') return [];

  const violations: string[] = [];
  const record = node as Record<string, unknown>;

  if ('maxItems' in record) {
    violations.push(`${path}.maxItems = ${record.maxItems} (not supported on arrays at all)`);
  }
  if ('minItems' in record) {
    const value = record.minItems;
    if (typeof value === 'number' && value !== 0 && value !== 1) {
      violations.push(`${path}.minItems = ${value} (only 0 or 1 is supported)`);
    }
  }
  if (record.type === 'integer' && ('minimum' in record || 'maximum' in record)) {
    violations.push(`${path} has minimum/maximum on type: integer (not supported; use enum instead)`);
  }

  for (const [key, value] of Object.entries(record)) {
    violations.push(...findUnsupportedConstraints(value, `${path}.${key}`));
  }
  return violations;
}

describe('LLM request schemas carry no unsupported constraint', () => {
  it('GENERATION_JSON_SCHEMA', () => {
    const violations = findUnsupportedConstraints(GENERATION_JSON_SCHEMA, 'schema');
    expect(violations).toEqual([]);
  });

  it('GRADE_JSON_SCHEMA', () => {
    const violations = findUnsupportedConstraints(GRADE_JSON_SCHEMA, 'schema');
    expect(violations).toEqual([]);
  });
});
