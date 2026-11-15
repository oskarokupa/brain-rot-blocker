/**
 * Validates a draft batch and writes its review sheet.
 *
 *   npx tsx content/tools/review-sheet.ts 01-medio
 *
 * Reads content/review/batch-<name>.ts, runs the same validation the bank
 * tests run plus the checks that only matter while authoring (clashes with
 * questions already in the bank, typed answers that the local grader would
 * not accept, a lopsided answer position), then writes batch-<name>.md for
 * the parent to approve. Exits non-zero on any problem, without writing.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_BANK_ES } from '../../src/fallback/bank.es.js';
import { gradeTypedLocally } from '../../src/quiz/grade.js';
import type { Question } from '../../src/quiz/schema.js';
import { validateQuestion } from '../../src/quiz/validate.js';
import type { BatchRef } from '../review/batch-01-medio.js';

const name = process.argv[2];
if (!name) {
  console.error('usage: review-sheet.ts <batch name, e.g. 01-medio>');
  process.exit(2);
}

const reviewDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'review');
const batch = (await import(join(reviewDir, `batch-${name}.ts`))) as {
  QUESTIONS: Question[];
  REFS: Record<string, BatchRef>;
};
const { QUESTIONS, REFS } = batch;

const norm = (text: string) => text.trim().toLowerCase();
const problems: string[] = [];

// Entries already promoted into the bank are skipped, so the sheet can be
// regenerated after a batch has landed without flagging it against itself.
const bankIds = new Set(FALLBACK_BANK_ES.map((q) => q.id));
const bankPrompts = new Map(FALLBACK_BANK_ES.map((q) => [norm(q.prompt), q.id]));
const seenIds = new Set<string>();
const seenPrompts = new Set<string>();

for (const q of QUESTIONS) {
  const result = validateQuestion(q);
  for (const p of result.problems) problems.push(`${q.id}: ${p}`);

  if (seenIds.has(q.id)) problems.push(`${q.id}: id repeated inside the batch`);
  if (seenPrompts.has(norm(q.prompt))) problems.push(`${q.id}: prompt repeated inside the batch`);
  seenIds.add(q.id);
  seenPrompts.add(norm(q.prompt));

  const clash = bankPrompts.get(norm(q.prompt));
  if (clash && clash !== q.id) problems.push(`${q.id}: same prompt as ${clash} in the bank`);
  if (bankIds.has(q.id) && !clash) problems.push(`${q.id}: id already used in the bank by another question`);

  if (!REFS[q.id]) problems.push(`${q.id}: no curriculum ref`);
  if (!q.meta?.subject || !q.meta.topic || !q.meta.difficulty) problems.push(`${q.id}: incomplete meta`);

  if (q.type === 'typed') {
    for (const answer of [q.expectedConcept, ...q.exampleAnswers]) {
      if (gradeTypedLocally(q, answer) !== 'correct') {
        problems.push(`${q.id}: local grading does not accept "${answer}"`);
      }
    }
    const fallback = q.fallbackMultipleChoice;
    if (fallback.meta?.subject !== q.meta?.subject || fallback.meta?.difficulty !== q.meta?.difficulty) {
      problems.push(`${q.id}: fallback meta differs from the question`);
    }
    // The child must not be able to pass a typed question with a distractor.
    fallback.options.forEach((option, i) => {
      if (i !== fallback.correctIndex && gradeTypedLocally(q, option) === 'correct') {
        problems.push(`${q.id}: local grading accepts the wrong answer "${option}"`);
      }
    });
  }
}

const singles = QUESTIONS.filter((q) => q.type === 'singleSelect');
const positions = [0, 0, 0, 0];
for (const q of singles) {
  if (q.type === 'singleSelect') positions[q.correctIndex] = (positions[q.correctIndex] ?? 0) + 1;
}
const mostUsed = Math.max(...positions);
if (singles.length >= 8 && mostUsed / singles.length > 0.4) {
  problems.push(`correct answer sits at one position in ${mostUsed} of ${singles.length} single-select questions`);
}

if (problems.length > 0) {
  console.error(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const TYPE_LABEL = { singleSelect: 'una', multiSelect: 'varias', typed: 'escrita' } as const;

function answerCell(q: Question): string {
  if (q.type === 'singleSelect') {
    return q.options.map((o, i) => (i === q.correctIndex ? `**${o}**` : o)).join(' / ');
  }
  if (q.type === 'multiSelect') {
    return q.options.map((o, i) => (q.correctIndices.includes(i) ? `**${o}**` : o)).join(' / ');
  }
  const fallback = q.fallbackMultipleChoice;
  const options = fallback.options.map((o, i) => (i === fallback.correctIndex ? `**${o}**` : o)).join(' / ');
  return `Acepta: ${q.exampleAnswers.join(', ')}. Si duda, pasa a opciones: ${options}`;
}

const count = (pick: (q: Question) => string | number | undefined) => {
  const tally = new Map<string, number>();
  for (const q of QUESTIONS) tally.set(String(pick(q)), (tally.get(String(pick(q))) ?? 0) + 1);
  return [...tally].map(([k, v]) => `${k} ${v}`).join(', ');
};

const inBank = QUESTIONS.filter((q) => bankIds.has(q.id)).length;

const lines = [
  `# Review sheet, batch ${name}`,
  '',
  `${QUESTIONS.length} questions. ${inBank === 0 ? 'None of them is in the bank yet.' : `${inBank} of them are already in the bank.`}`,
  '',
  'Leave the first column empty to approve a row. Write `x` to drop it, or write the change you want.',
  'Bold marks the correct answer. Ref is the row in `content/curriculum-map.md`.',
  '',
  `Types: ${count((q) => TYPE_LABEL[q.type])}. Difficulty: ${count((q) => q.meta?.difficulty)}. ` +
    `Correct position in single-select (a/b/c/d): ${positions.join('/')}.`,
  '',
  '| Decision | Id | Tipo | Nivel | Pregunta | Respuestas | Explicación | Ref | Fuente |',
  '|---|---|---|---|---|---|---|---|---|',
  ...QUESTIONS.map((q) =>
    [
      '',
      ' ',
      q.id,
      TYPE_LABEL[q.type],
      String(q.meta?.difficulty),
      cell(q.prompt),
      cell(answerCell(q)),
      cell(q.explanation),
      REFS[q.id]?.row ?? '',
      cell(REFS[q.id]?.source ?? ''),
      '',
    ].join(' | ').trim(),
  ),
  '',
];

const out = join(reviewDir, `batch-${name}.md`);
writeFileSync(out, lines.join('\n'));
console.log(`ok: ${QUESTIONS.length} questions, wrote ${out}`);
