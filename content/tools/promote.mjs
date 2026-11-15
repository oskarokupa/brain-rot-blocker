/**
 * Moves an approved batch into the bank.
 *
 *   node content/tools/promote.mjs 02-medio medio "Sociedad, territorio e historia"
 *
 * Appends the body of QUESTIONS from content/review/batch-<name>.ts to
 * src/fallback/bank/<subject>.es.ts, prefixing the section comments with the
 * given label. Run review-sheet.ts first: this script copies, it does not check.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [name, subject, label] = process.argv.slice(2);
if (!name || !subject || !label) {
  console.error('usage: promote.mjs <batch name> <subject file> <section label>');
  process.exit(2);
}

const batch = readFileSync(`content/review/batch-${name}.ts`, 'utf8');
const start = batch.indexOf('export const QUESTIONS: Question[] = [\n');
const end = batch.indexOf('\n];', start);
if (start < 0 || end < 0) throw new Error('could not find QUESTIONS in the batch');
const body = batch
  .slice(start + 'export const QUESTIONS: Question[] = [\n'.length, end)
  .replace(/\/\/ ---- (Single-select|Multi-select|Typed) ----/g, (_m, type) => `// ---- ${label}: ${type.toLowerCase()} ----`);

const bankPath = `src/fallback/bank/${subject}.es.ts`;
const bank = readFileSync(bankPath, 'utf8');
const firstId = /id: '([^']+)'/.exec(body)?.[1];
if (firstId && bank.includes(`id: '${firstId}'`)) throw new Error(`${firstId} is already in ${bankPath}`);
const close = bank.lastIndexOf('];');
writeFileSync(bankPath, `${bank.slice(0, close).trimEnd()}\n\n${body}\n];\n`);
console.log(`appended batch ${name} to ${bankPath}`);
