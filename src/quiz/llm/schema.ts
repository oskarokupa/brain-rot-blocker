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
 * Arrays carry no length constraint at all. Confirmed against two separate
 * live 400s from the API: first "'minItems' values other than 0 or 1 are not
 * supported", and after removing those, "property 'maxItems' is not
 * supported" - unlike minItems, maxItems is rejected outright regardless of
 * value, not just restricted to a range. An array schema here may say what
 * its items look like and nothing about how many of them there are.
 *
 * Every count this schema used to enforce (3 single-select questions, 4
 * options each, 5 multi-select options, 6 remediation questions, and so on)
 * is now enforced in exactly one place instead of two: stated explicitly in
 * the prompt (see EXACT_COUNTS in prompts.ts), and checked by validate.ts
 * after the fact, which rejects a short or long array exactly as it already
 * rejects every other malformed shape and triggers the same
 * regenerate-then-fallback path.
 *
 * A third live 400 added one more restriction to the pile: `minimum` and
 * `maximum` are rejected outright on `type: integer` (confirmed `number`
 * accepts them, and confirmed `integer` with `enum` works, in direct tests
 * against the live API). Every bounded integer below uses `enum` for exactly
 * that reason - not a style preference, the only way to bound an integer that
 * this API's structured outputs will accept.
 */

const singleSelectItemSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correctIndex: { type: 'integer', enum: [0, 1, 2, 3] },
    explanation: { type: 'string' },
  },
  required: ['prompt', 'options', 'correctIndex', 'explanation'],
  additionalProperties: false,
} as const;

const multiSelectItemSchema = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correctIndices: {
      type: 'array',
      items: { type: 'integer', enum: [0, 1, 2, 3, 4] },
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
    keywords: { type: 'array', items: { type: 'string' } },
    exampleAnswers: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    fallbackOptions: { type: 'array', items: { type: 'string' } },
    fallbackCorrectIndex: { type: 'integer', enum: [0, 1, 2, 3] },
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
    singleSelect: { type: 'array', items: singleSelectItemSchema },
    multiSelect: multiSelectItemSchema,
    typed: typedItemSchema,
    spares: { type: 'array', items: singleSelectItemSchema },
    remediation: { type: 'array', items: remediationItemSchema },
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
