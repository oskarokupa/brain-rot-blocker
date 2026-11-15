# Grow the offline question bank from 36 to 200

Source: ~/.claude/plans/this-is-the-plan-hidden-crystal.md

## Context

The offline fallback bank (`src/fallback/bank.es.ts`) has 36 Spanish questions and the no-repeat window is 40, so the child sees repeats almost immediately whenever a video has no transcript or the LLM is unreachable. The SOP target is 150 to 200. The pasted plan (in Spanish) proposes a RAG pipeline with a vector database over the Catalan curriculum (Decret 175/2022), the Generalitat's released exams and open teaching content.

Decisions confirmed with the user on 2026-11-15:

- Questions are written in Spanish only. The Catalan decree is the syllabus, not the language.
- Subjects are matemáticas, lengua castellana and coneixement del medi (new). No inglés.
- Level runs from 4t to 6è, so Cicle Superior content enters as difficulty 3.
- The user approves each batch in a review sheet before it is committed to the bank.

## Decision on the vector database: none

The plan's source list and its metadata idea are right. The vector database is not, for three reasons.

1. Nothing retrieves at runtime. The bank ships inside the extension as static typed data and must work with the network unplugged. Retrieval only matters while the questions are being written.
2. The corpus is tiny: three curriculum PDFs and a handful of exam booklets. Each one fits whole in a model's context, so similarity search has nothing to rank that a direct read does not already see.
3. The curriculum is already structured (area, cicle, saber, criteri). A lookup table keyed by those fields is exact, where embeddings are approximate. The plan's "strict metadata per chunk" becomes the rows of a plain curriculum map file.

So the pipeline is an authoring-time one with no new runtime code and no new dependencies: sources, then a curriculum map, then batches written against the map, then review, then the bank.

## Steps

### 1. Collect sources into `content/sources/`

- `Matematiques.pdf` and `Aranes-Castella-Catala.pdf` from `xtec.gencat.cat/web/.content/curriculum/primaria/curriculum-175-2022/` (both verified, HTTP 200).
- The medi PDF. The plan's `Coneixement-medi.pdf` URL returns 404 (so does `Llengues-estrangeres.pdf`, which is no longer needed). Find the real file name from the XTEC "Currículum Primària" index page.
- Released 4t diagnostic booklets and correction criteria (matemàtiques, castellà, medi) from `avaluacioeducativa.gencat.cat/ca/avaluacions/diagnostic/quart-primaria`.
- Released 6è competències bàsiques booklets from the same site (`/avaluacions/final-etapa/primaria/`), because the level now reaches 6è.
- Write `content/SOURCES.md` listing every file with URL and download date. Add `content/sources/*.pdf` to `.gitignore` (public documents, no reason to carry the binaries in the repo).
- PDFs are read with the Read tool by page range (`pdftotext` is not installed).

### 2. Build the curriculum map: `content/curriculum-map.md`

One table per subject. Each row is one saber, with columns: subject, cicle (mitjà or superior), block (the decree's "sentit" or bloc), saber in one Spanish sentence, difficulty band, target question count, existing bank ids that already cover it. This is the plan's chunk metadata, kept as a file a person can read and edit.

The 36 existing questions are mapped first so the new ones fill gaps instead of piling onto multiplicación and gramática.

For medi, the decree names topics without the facts (it says "rivers", not Llobregat). Facts for those rows come from the exam booklets and XTEC/ARC teaching material, and each fact-based question records its source in the review sheet.

### 3. Target distribution (200 total)

| Subject | Now | Target |
|---|---|---|
| Matemáticas | 19 | 75 |
| Lengua castellana | 17 | 65 |
| Conocimiento del medio | 0 | 60 |

- Type mix follows the 3/1/1 quiz shape in `typeMixFor` (`src/fallback/select.ts`): about 120 singleSelect, 40 typed, 40 multiSelect.
- Difficulty: about 30% level 1, 40% level 2 (both 4t), 30% level 3 (5è and 6è). `selectRemediationPool` already treats difficulty 2 and below as the easier tier, so remediation stays at 4t level with no code change.
- Lengua includes short reading-comprehension items modelled on the exam booklets, with the text kept to two or three sentences inside the prompt (the schema has no separate passage field and the plan does not add one).

### 4. Code changes (small)

- `src/quiz/schema.ts`: widen `QuestionMeta.subject` to `'matematicas' | 'lengua' | 'medio'`.
- Split the bank by subject so no file reaches 2,000 lines: `src/fallback/bank/matematicas.es.ts`, `lengua.es.ts`, `medio.es.ts`. `src/fallback/bank.es.ts` stays as the single export (`FALLBACK_BANK_ES` = the three arrays concatenated), so `select.ts` and the tests keep their imports. Update the header comment that still says "this is 36".
- Existing ids are kept unchanged (they live in the child's stored history). New ids continue the pattern: `mat-ss-11`, `len-ty-05`, `med-ms-01`.
- `src/config.ts`: raise `fallback.noRepeatWindow` from 40 to 120. A five-question quiz records up to 13 ids (5 questions, 2 spares, 6 remediation), so 120 gives roughly nine quizzes before anything can repeat, while leaving 80 fresh questions for `pickType` to choose from.
- No change to `select.ts`, `validate.ts`, the LLM path or the UI.

### 5. Tests: `tests/fallbackBank.test.ts`

The per-entry validation, unique id and duplicate prompt tests already scale through `it.each`. Change and add:

- Subjects equal `matematicas`, `lengua`, `medio`.
- Total is at least 200, each subject at least 55.
- Each subject has all three question types and all three difficulties.
- Type share stays close to 3/1/1 (singleSelect at least 55%, typed and multiSelect at least 15% each).
- The correct answer position in singleSelect is not skewed: no index holds more than 40% (the seed bank leans on index 1, and a child spots that pattern quickly).
- Every typed question's `fallbackMultipleChoice` carries the same subject and difficulty as its parent.

### 6. Authoring and review loop

164 new questions in six batches: medi 2 x 30, matemáticas 2 x 28, lengua 2 x 24. Medi (the new subject) goes first, so the user can correct the tone early.

For each batch:

1. Write the questions against the curriculum map rows, using the released exam items as style and level reference (paraphrased, never copied word for word).
2. Self-check pass: re-solve every question from the prompt alone without looking at the marked answer, confirm distractors are wrong, confirm multiSelect has 2 or 3 correct and not all, confirm typed keywords accept the obvious spellings with and without accents.
3. Write `content/review/batch-NN-<subject>.md`: one row per question with id, prompt, options with the correct one marked, explanation, curriculum ref (area, cicle, saber) and source for any fact. The user strikes or edits rows.
4. Only approved rows go into the bank file. Run `npm test` and `npm run typecheck`.
5. Commit the batch on a new branch `bank-200` (off `phase-8-ui`, never on `main`).

## Critical files

- `src/fallback/bank.es.ts`, new `src/fallback/bank/*.es.ts`
- `src/quiz/schema.ts` (subject union)
- `src/config.ts` (`fallback.noRepeatWindow`)
- `tests/fallbackBank.test.ts`
- New, authoring only: `content/SOURCES.md`, `content/curriculum-map.md`, `content/review/batch-*.md`

Reused as is: `validateQuestion` in `src/quiz/validate.ts`, `selectFallbackQuiz` and `selectRemediationPool` in `src/fallback/select.ts`, `recordUsed` in `src/quiz/history.ts`.

## Verification

- `npm run typecheck` and `npm test` after every batch (235 tests today, plus one validation case per new question and the new distribution tests).
- A throwaway script in the scratchpad draws 200 fallback quizzes with a rolling history and reports the first repeat and the subject spread per quiz, to confirm the 120 window behaves.
- `npm run build`, reload the extension, disconnect the network (or clear the API key in the options page) and play a video past the threshold: the quiz must come from the bank, show medi questions over a few runs and render Spanish UI strings.
- Add a `CHANGELOG.md` entry and tick off item 8 of the handoff's next steps.

## Housekeeping

On approval, copy this plan to `specs/plans/001-2026-11-15-grow-question-bank.md` (per the plan persistence rule) before any implementation step.

## Changes after approval

- 2026-11-15: The seed bank is 18 matemáticas and 18 lengua (not 19 and 17, the first count included the typed questions' fallback entries). To write: 57 matemáticas, 47 lengua, 60 medio. Batches are now medio 30 + 30, matemáticas 29 + 28, lengua 24 + 23.
- 2026-11-15: Each batch is drafted as typed data in `content/review/batch-NN-<subject>.ts`, and `content/tools/review-sheet.ts` validates it and generates the markdown review sheet (run with `npx tsx`, no dependency added). This replaces writing the sheet by hand, so the sheet and the data cannot drift apart.
- 2026-11-15: The `noRepeatWindow` change (40 to 120) and the distribution tests (total, per-subject minimum, type share, answer position) land with the last batch, not the first. With a window larger than the bank, every question counts as recent and selection degrades to random.
- 2026-11-15: `content/sources/` is git-ignored as a whole folder.
- 2026-11-15: The two maths batches are split by cycle instead of by size: batch 03 is Cicle Mitjà (35 questions, difficulty 1 and 2), batch 04 is Cicle Superior (22 questions, difficulty 3). Both were drafted together.
- 2026-11-15: The two lengua batches follow the same split by cycle: batch 05 is Cicle Mitjà (27 questions), batch 06 is Cicle Superior (20 questions).
- 2026-11-15: `src/fallback/select.ts` did change after all. The 200-quiz simulation showed that when every question of one type is inside the window, the repeat was random and could return two quizzes later. `pickType` now repeats the question seen longest ago. All six batches are approved and in the bank, which stands at exactly 200.
