/**
 * Batch 04, matemáticas, Cicle Superior (difficulty 3).
 *
 * A draft: nothing here ships. Approved entries are moved into
 * src/fallback/bank/matematicas.es.ts. Run
 * `npx tsx content/tools/review-sheet.ts 04-matematicas` to validate the batch
 * and regenerate batch-04-matematicas.md.
 */

import type { Question } from '../../src/quiz/schema.js';
import type { BatchRef } from './batch-01-medio.js';

const CALC = 'Cálculo propio, comprobado dos veces';
const SCHOOL = 'Contenido escolar estándar';

export const QUESTIONS: Question[] = [
  // ---- Single-select ----
  {
    id: 'mat-ss-32', type: 'singleSelect',
    prompt: '¿Cuál de estos números decimales es el mayor?',
    options: ['0,45', '0,405', '0,5', '0,054'], correctIndex: 2,
    explanation: 'Se comparan primero las décimas: 0,5 tiene 5 décimas, más que 0,45 y 0,405 (4 décimas) y que 0,054 (ninguna).',
    meta: { subject: 'matematicas', topic: 'decimales', difficulty: 3 },
  },
  {
    id: 'mat-ss-33', type: 'singleSelect',
    prompt: '¿Cuánto es 2,5 + 1,75?',
    options: ['3,25', '4,25', '4,125', '3,80'], correctIndex: 1,
    explanation: '2,50 + 1,75 = 4,25. Ayuda escribir los dos números con las mismas cifras decimales.',
    meta: { subject: 'matematicas', topic: 'decimales', difficulty: 3 },
  },
  {
    id: 'mat-ss-34', type: 'singleSelect',
    prompt: 'En el número 4,372, ¿qué cifra ocupa el lugar de las centésimas?',
    options: ['4', '3', '7', '2'], correctIndex: 2,
    explanation: 'Después de la coma van las décimas (3), las centésimas (7) y las milésimas (2).',
    meta: { subject: 'matematicas', topic: 'decimales', difficulty: 3 },
  },
  {
    id: 'mat-ss-35', type: 'singleSelect',
    prompt: '¿Qué porcentaje equivale a la fracción 1/4?',
    options: ['4 %', '14 %', '40 %', '25 %'], correctIndex: 3,
    explanation: 'Un cuarto de 100 es 25, así que 1/4 equivale al 25 %.',
    meta: { subject: 'matematicas', topic: 'porcentajes', difficulty: 3 },
  },
  {
    id: 'mat-ss-36', type: 'singleSelect',
    prompt: 'Una camiseta cuesta 20 € y tiene un 10 % de descuento. ¿Cuánto pagas?',
    options: ['10 €', '2 €', '19 €', '18 €'], correctIndex: 3,
    explanation: 'El 10 % de 20 € son 2 €. Pagas 20 - 2 = 18 €.',
    meta: { subject: 'matematicas', topic: 'porcentajes', difficulty: 3 },
  },
  {
    id: 'mat-ss-37', type: 'singleSelect',
    prompt: '¿Cuánto es 5 al cuadrado?',
    options: ['25', '10', '15', '125'], correctIndex: 0,
    explanation: 'Elevar al cuadrado es multiplicar un número por sí mismo: 5 x 5 = 25.',
    meta: { subject: 'matematicas', topic: 'potencias', difficulty: 3 },
  },
  {
    id: 'mat-ss-38', type: 'singleSelect',
    prompt: '¿Cuánto es 4 + 6 x 2?',
    options: ['20', '16', '14', '24'], correctIndex: 1,
    explanation: 'Primero se hace la multiplicación: 6 x 2 = 12. Después la suma: 4 + 12 = 16.',
    meta: { subject: 'matematicas', topic: 'operaciones', difficulty: 3 },
  },
  {
    id: 'mat-ss-39', type: 'singleSelect',
    prompt: 'Para 4 personas se necesitan 200 g de arroz. ¿Cuánto arroz se necesita para 6 personas?',
    options: ['250 g', '400 g', '600 g', '300 g'], correctIndex: 3,
    explanation: 'Cada persona necesita 200 ÷ 4 = 50 g. Para 6 personas son 6 x 50 = 300 g.',
    meta: { subject: 'matematicas', topic: 'proporcionalidad', difficulty: 3 },
  },
  {
    id: 'mat-ss-40', type: 'singleSelect',
    prompt: 'En un mapa, 1 cm representa 5 km. Dos pueblos están separados 4 cm en el mapa. ¿Qué distancia real hay entre ellos?',
    options: ['20 km', '9 km', '5 km', '4 km'], correctIndex: 0,
    explanation: 'Cada centímetro del mapa son 5 km reales, así que 4 cm son 4 x 5 = 20 km.',
    meta: { subject: 'matematicas', topic: 'proporcionalidad', difficulty: 3 },
  },
  {
    id: 'mat-ss-41', type: 'singleSelect',
    prompt: 'Una habitación rectangular mide 5 m de largo y 4 m de ancho. ¿Cuál es su área?',
    options: ['9 m²', '18 m²', '20 m²', '40 m²'], correctIndex: 2,
    explanation: 'El área de un rectángulo es largo por ancho: 5 x 4 = 20 m².',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 3 },
  },
  {
    id: 'mat-ss-42', type: 'singleSelect',
    prompt: '¿Cuánto mide un ángulo recto?',
    options: ['45°', '180°', '360°', '90°'], correctIndex: 3,
    explanation: 'Un ángulo recto mide 90°, como las esquinas de una hoja de papel.',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 3 },
  },
  {
    id: 'mat-ss-43', type: 'singleSelect',
    prompt: 'Un cuadrado tiene 36 cm de perímetro. ¿Cuánto mide cada lado?',
    options: ['6 cm', '9 cm', '12 cm', '18 cm'], correctIndex: 1,
    explanation: 'Los cuatro lados de un cuadrado son iguales, así que cada uno mide 36 ÷ 4 = 9 cm.',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 3 },
  },
  {
    id: 'mat-ss-44', type: 'singleSelect',
    prompt: 'Las notas de Leo en tres exámenes son 6, 8 y 10. ¿Cuál es su nota media?',
    options: ['7', '9', '24', '8'], correctIndex: 3,
    explanation: 'La media se calcula sumando las notas y dividiendo entre cuántas son: (6 + 8 + 10) ÷ 3 = 8.',
    meta: { subject: 'matematicas', topic: 'datos', difficulty: 3 },
  },
  {
    id: 'mat-ss-45', type: 'singleSelect',
    prompt: 'Si 3 x n = 27, ¿cuánto vale n?',
    options: ['9', '8', '24', '30'], correctIndex: 0,
    explanation: 'n vale 9, porque 3 x 9 = 27.',
    meta: { subject: 'matematicas', topic: 'algebra', difficulty: 3 },
  },

  // ---- Multi-select ----
  {
    id: 'mat-ms-12', type: 'multiSelect',
    prompt: '¿Cuáles de estas expresiones valen lo mismo que 1/2?',
    options: ['0,5', '50 %', '0,2', '2/4', '5 %'], correctIndices: [0, 1, 3],
    explanation: 'La mitad se puede escribir como 0,5, como 50 % o como 2/4.',
    meta: { subject: 'matematicas', topic: 'porcentajes', difficulty: 3 },
  },
  {
    id: 'mat-ms-13', type: 'multiSelect',
    prompt: '¿Cuáles de estos números son divisores de 24?',
    options: ['3', '5', '8', '9', '12'], correctIndices: [0, 2, 4],
    explanation: '24 se puede dividir de forma exacta entre 3, entre 8 y entre 12. Entre 5 y entre 9 sobra resto.',
    meta: { subject: 'matematicas', topic: 'divisibilidad', difficulty: 3 },
  },
  {
    id: 'mat-ms-14', type: 'multiSelect',
    prompt: '¿Cuáles de estos ángulos son agudos, es decir, miden menos de 90°?',
    options: ['30°', '95°', '60°', '120°', '89°'], correctIndices: [0, 2, 4],
    explanation: 'Los ángulos de 30°, 60° y 89° miden menos de 90°. Los de 95° y 120° son obtusos.',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 3 },
  },
  {
    id: 'mat-ms-15', type: 'multiSelect',
    prompt: 'Lanzas una moneda al aire. ¿Cuáles de estas frases son verdaderas?',
    options: ['Cara y cruz son igual de probables', 'Es seguro que sale cara', 'La probabilidad de cara es 1/2', 'Es imposible que salga cruz', 'Puede salir cara dos veces seguidas'], correctIndices: [0, 2, 4],
    explanation: 'Cara y cruz tienen la misma probabilidad, 1/2 cada una. Nada es seguro ni imposible, y puede salir cara varias veces seguidas.',
    meta: { subject: 'matematicas', topic: 'datos', difficulty: 3 },
  },

  // ---- Typed ----
  {
    id: 'mat-ty-12', type: 'typed',
    prompt: '¿Cuánto es 0,25 x 100?',
    expectedConcept: '25', keywords: ['25'],
    exampleAnswers: ['25', 'Son 25', 'Veinticinco'],
    fallbackMultipleChoice: {
      id: 'mat-ty-12-mc', type: 'singleSelect',
      prompt: '¿Cuánto es 0,25 x 100?',
      options: ['2,5', '250', '25', '0,025'], correctIndex: 2,
      explanation: 'Al multiplicar por 100, la coma se mueve dos lugares a la derecha: 0,25 x 100 = 25.',
      meta: { subject: 'matematicas', topic: 'decimales', difficulty: 3 },
    },
    explanation: 'Al multiplicar por 100, la coma se mueve dos lugares a la derecha: 0,25 x 100 = 25.',
    meta: { subject: 'matematicas', topic: 'decimales', difficulty: 3 },
  },
  {
    id: 'mat-ty-13', type: 'typed',
    prompt: '¿Cuánto es el 50 % de 80?',
    expectedConcept: '40', keywords: ['40'],
    exampleAnswers: ['40', 'Son 40', 'Cuarenta'],
    fallbackMultipleChoice: {
      id: 'mat-ty-13-mc', type: 'singleSelect',
      prompt: '¿Cuánto es el 50 % de 80?',
      options: ['30', '40', '50', '130'], correctIndex: 1,
      explanation: 'El 50 % es la mitad, y la mitad de 80 es 40.',
      meta: { subject: 'matematicas', topic: 'porcentajes', difficulty: 3 },
    },
    explanation: 'El 50 % es la mitad, y la mitad de 80 es 40.',
    meta: { subject: 'matematicas', topic: 'porcentajes', difficulty: 3 },
  },
  {
    id: 'mat-ty-14', type: 'typed',
    prompt: 'Tres entradas de cine cuestan 21 €. ¿Cuántos euros cuestan 5 entradas?',
    expectedConcept: '35', keywords: ['35'],
    exampleAnswers: ['35', '35 euros', '35 €', 'Treinta y cinco', 'Treinta y cinco euros'],
    fallbackMultipleChoice: {
      id: 'mat-ty-14-mc', type: 'singleSelect',
      prompt: 'Tres entradas de cine cuestan 21 €. ¿Cuántos euros cuestan 5 entradas?',
      options: ['28 €', '30 €', '105 €', '35 €'], correctIndex: 3,
      explanation: 'Cada entrada cuesta 21 ÷ 3 = 7 €. Cinco entradas cuestan 5 x 7 = 35 €.',
      meta: { subject: 'matematicas', topic: 'proporcionalidad', difficulty: 3 },
    },
    explanation: 'Cada entrada cuesta 21 ÷ 3 = 7 €. Cinco entradas cuestan 5 x 7 = 35 €.',
    meta: { subject: 'matematicas', topic: 'proporcionalidad', difficulty: 3 },
  },
  {
    id: 'mat-ty-15', type: 'typed',
    prompt: 'Si n + 15 = 40, ¿cuánto vale n?',
    expectedConcept: '25', keywords: ['25'],
    exampleAnswers: ['25', 'n = 25', 'Vale 25', 'Veinticinco'],
    fallbackMultipleChoice: {
      id: 'mat-ty-15-mc', type: 'singleSelect',
      prompt: 'Si n + 15 = 40, ¿cuánto vale n?',
      options: ['25', '15', '55', '35'], correctIndex: 0,
      explanation: 'n vale 25, porque 40 - 15 = 25.',
      meta: { subject: 'matematicas', topic: 'algebra', difficulty: 3 },
    },
    explanation: 'n vale 25, porque 40 - 15 = 25.',
    meta: { subject: 'matematicas', topic: 'algebra', difficulty: 3 },
  },
];

export const REFS: Record<string, BatchRef> = {
  'mat-ss-32': { row: 'N6', source: CALC },
  'mat-ss-33': { row: 'N6', source: CALC },
  'mat-ss-34': { row: 'N6', source: SCHOOL },
  'mat-ss-35': { row: 'N7', source: CALC },
  'mat-ss-36': { row: 'N7', source: 'Decret 175/2022, problemas de precios y rebajas' },
  'mat-ss-37': { row: 'N8', source: CALC },
  'mat-ss-38': { row: 'N8', source: 'Jerarquía de las operaciones (contenido escolar estándar)' },
  'mat-ss-39': { row: 'N9', source: CALC },
  'mat-ss-40': { row: 'N9', source: 'Decret 175/2022, escalas en planos y mapas' },
  'mat-ss-41': { row: 'E2', source: CALC },
  'mat-ss-42': { row: 'E2', source: SCHOOL },
  'mat-ss-43': { row: 'E2', source: CALC },
  'mat-ss-44': { row: 'D2', source: CALC },
  'mat-ss-45': { row: 'A2', source: CALC },
  'mat-ms-12': { row: 'N7', source: CALC },
  'mat-ms-13': { row: 'N8', source: CALC },
  'mat-ms-14': { row: 'E2', source: SCHOOL },
  'mat-ms-15': { row: 'D2', source: SCHOOL },
  'mat-ty-12': { row: 'N6', source: CALC },
  'mat-ty-13': { row: 'N7', source: CALC },
  'mat-ty-14': { row: 'N9', source: CALC },
  'mat-ty-15': { row: 'A2', source: CALC },
};
