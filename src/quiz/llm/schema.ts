/**
 * The shape asked of the model, and the JSON Schema that constrains it.
 *
 * Deliberately flat rather than a discriminated union of question types.
 * Structured-output JSON Schema support for oneOf/discriminated unions is not
 * something to assume works reliably, so the model is asked for three
 * separately-typed slots instead of one polymorphic array. This is converted
 * into the normal Question[] shape in generate.ts, after which nothing
 * downstream knows or cares that the request was flat.
 *
 * Every field the generator must produce mirrors what validate.ts checks,
 * which is also what makes a shape pulled straight from the API still get
 * run through full validation: the schema prevents malformed JSON, not a
 * bad question.
 *
 * No array below sets `minItems` above 1. Confirmed against a live 400 from
 * the API: "For 'array' type, 'minItems' values other than 0 or 1 are not
 * supported." `maxItems` is unaffected and still pins the ceiling; the exact
 * counts this schema used to enforce on both ends (3 single-select, 5
 * multi-select options, 6 remediation questions, and so on) are instead
 * enforced by validate.ts after the fact; a short response fails validation
 * and triggers the same regenerate-then-fallback path a bad response of any
 * other kind would.
 */

const singleSelectItemSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
    explanation: { type: 'string' },
  },
  required: ['prompt', 'options', 'correctIndex', 'explanation'],
  additionalProperties: false,
} as const;

const multiSelectItemSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    correctIndices: {
      type: 'array',
      items: { type: 'integer', minimum: 0, maximum: 4 },
      maxItems: 3,
    },
    explanation: { type: 'string' },
  },
  required: ['prompt', 'options', 'correctIndices', 'explanation'],
  additionalProperties: false,
} as const;

const typedItemSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    expectedConcept: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
    exampleAnswers: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    explanation: { type: 'string' },
    fallbackOptions: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    fallbackCorrectIndex: { type: 'integer', minimum: 0, maximum: 3 },
  },
  required: [
    'prompt',
    'expectedConcept',
    'keywords',
    'exampleAnswers',
    'explanation',
    'fallbackOptions',
    'fallbackCorrectIndex',
  ],
  additionalProperties: false,
} as const;

const remediationItemSchema = {
  type: 'object',
  properties: {
    ...singleSelectItemSchema.properties,
    difficulty: { type: 'integer', enum: [1, 2] },
  },
  required: [...singleSelectItemSchema.required, 'difficulty'],
  additionalProperties: false,
} as const;

/** The exact JSON Schema sent as output_config.format.schema. */
export const GENERATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    singleSelect: { type: 'array', items: singleSelectItemSchema, maxItems: 3 },
    multiSelect: multiSelectItemSchema,
    typed: typedItemSchema,
    spares: { type: 'array', items: singleSelectItemSchema, maxItems: 2 },
    remediation: { type: 'array', items: remediationItemSchema, maxItems: 6 },
  },
  required: ['singleSelect', 'multiSelect', 'typed', 'spares', 'remediation'],
  additionalProperties: false,
} as const;

export interface GeneratedSingleSelect {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GeneratedMultiSelect {
  prompt: string;
  options: string[];
  correctIndices: number[];
  explanation: string;
}

export interface GeneratedTyped {
  prompt: string;
  expectedConcept: string;
  keywords: string[];
  exampleAnswers: string[];
  explanation: string;
  fallbackOptions: string[];
  fallbackCorrectIndex: number;
}

export interface GeneratedRemediationItem extends GeneratedSingleSelect {
  difficulty: 1 | 2;
}

export interface GeneratedBundle {
  singleSelect: GeneratedSingleSelect[];
  multiSelect: GeneratedMultiSelect;
  typed: GeneratedTyped;
  spares: GeneratedSingleSelect[];
  remediation: GeneratedRemediationItem[];
}

/** The schema for the typed-answer grading call: one field, nothing to parse loosely. */
export const GRADE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    equivalent: { type: 'boolean' },
  },
  required: ['equivalent'],
  additionalProperties: false,
} as const;

export interface GradeVerdict {
  equivalent: boolean;
}
