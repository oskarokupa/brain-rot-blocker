# Sources for the offline question bank

Everything the bank is written against. The PDFs live in `content/sources/` (git-ignored, they are public downloads). All files were downloaded on 2026-11-15.

Nothing here is read at runtime. The sources feed `content/curriculum-map.md`, the map feeds the review batches in `content/review/`, and approved questions land in `src/fallback/bank/`.

## Syllabus (Decret 175/2022, annex 2, primary areas)

Index page: https://xtec.gencat.cat/ca/curriculum/primaria/curriculum-175-2022/

| File | URL | Used for |
|---|---|---|
| `Matematiques.pdf` | https://xtec.gencat.cat/web/.content/curriculum/primaria/curriculum-175-2022/Matematiques.pdf | Matemáticas, sabers on pages 16 to 24 |
| `Aranes-Castella-Catala.pdf` | https://xtec.gencat.cat/web/.content/curriculum/primaria/curriculum-175-2022/Aranes-Castella-Catala.pdf | Lengua castellana, sabers on pages 19 to 25 |
| `Coneixement-del-Medi-Natural-Social-i-Cultural.pdf` | https://xtec.gencat.cat/web/.content/curriculum/primaria/curriculum-175-2022/Coneixement-del-Medi-Natural-Social-i-Cultural.pdf | Conocimiento del medio, sabers on pages 18 to 25 |

The original plan named `Coneixement-medi.pdf` and `Llengues-estrangeres.pdf`. Both return 404. The medi file has the longer name above, and the foreign language area is out of scope.

## Released exams (level and style reference)

Published by the Agència d'Avaluació i Prospectiva de l'Educació. Items are used as a guide to level, context and wording. No item is copied.

4t diagnostic test, 2025-2026, from https://avaluacioeducativa.gencat.cat/ca/avaluacions/diagnostic/quart-primaria/proves-corregides/2025-2026

| File | Content |
|---|---|
| `4t-2026/AD4P-26-Q1.pdf` | Booklet 1: català, matemàtiques, medi |
| `4t-2026/AD4P-26-Q2.pdf` | Booklet 2: català, matemàtiques, medi |
| `4t-2026/AD4P-26-Q4.pdf` | Booklet 4: castellà, medi |
| `4t-2026/AD4P-26-Q5.pdf` | Booklet 5: castellà, matemàtiques, medi |
| `4t-2026/AD4P-26_Marc_Especificacions_Claus_de_respostes.pdf` | Item specifications by area, saber block and cognitive level, plus the answer key |

4t diagnostic test, 2024-2025, from https://avaluacioeducativa.gencat.cat/ca/avaluacions/diagnostic/quart-primaria/proves-corregides/2024-2025

| File | Content |
|---|---|
| `4t-2025/ad4p2025-q1.pdf`, `q2`, `q3`, `q4`, `q6` | Booklets (q5a and q5f, the foreign language booklets, were not downloaded) |
| `4t-2025/solucionari-ad4p-24-25.pdf` | Answer key |

6è end-of-stage test, 2024-2025, from https://avaluacioeducativa.gencat.cat/ca/avaluacions/final-etapa/primaria/proves-corregides/per-anys/proves-2024-2025

| File | Content |
|---|---|
| `6e-2025/prova-matematica-a6p2025.pdf`, `criteris-correccio-matematica-a6p2025.pdf` | Maths test and marking criteria |
| `6e-2025/prova-castella-a6p2025.pdf`, `criteris-correcio-llengues-a6p2025.pdf` | Spanish test and marking criteria for the language tests |
| `6e-2025/prova-ciencia-a6p2025.pdf`, `criteris-correccio-ciencia-a6p2025.pdf` | Science, technology and engineering test and marking criteria |

## What the exams taught us about item style

- Items hang from a short real-world context (waste, drought, a school garden) instead of asking for a bare definition.
- Simple multiple choice always has four options and one correct answer. That is our single-select.
- The "Sí / No for each statement" items are our multi-select: several statements, some true.
- Each area mixes three cognitive levels (basic, intermediate, higher) in roughly thirds, which matches our difficulty 1 to 3 split.
- Many exam items read a chart or a picture. The bank has no images, so those sabers are covered with data written into the prompt, or left out.

## How to refresh

1. Download the files again from the URLs above into `content/sources/`.
2. Read them page by page (the PDFs carry a text layer), and update `content/curriculum-map.md` if a saber changed.
3. Write new questions as a draft batch in `content/review/` and run `npx tsx content/tools/review-sheet.ts <batch>`.
