/**
 * The offline fallback question bank. Spanish, Primary Year 4 to Year 6.
 *
 * Used whenever a video has no usable transcript, or the LLM is unreachable.
 * Entirely self-contained: no network, no API key, works with the computer
 * unplugged from the internet.
 *
 * Written as typed data rather than a bare .json file on purpose: TypeScript
 * catches a malformed entry (wrong option count, a multiSelect with every
 * option marked correct) at build time, before validate.ts ever has to.
 *
 * One file per subject under ./bank, concatenated here so everything that
 * selects from the bank keeps a single import. The syllabus behind the
 * questions is the Catalan curriculum (Decret 175/2022); content/SOURCES.md
 * and content/curriculum-map.md record where each topic comes from.
 * Difficulty 1 and 2 are Year 4 level, difficulty 3 is Year 5 and 6.
 *
 * Ids are stored in the child's no-repeat history, so never rename one.
 */

import type { Question } from '../quiz/schema.js';
import { LENGUA_ES } from './bank/lengua.es.js';
import { MATEMATICAS_ES } from './bank/matematicas.es.js';
import { MEDIO_ES } from './bank/medio.es.js';

export const FALLBACK_BANK_ES: Question[] = [...MATEMATICAS_ES, ...LENGUA_ES, ...MEDIO_ES];
