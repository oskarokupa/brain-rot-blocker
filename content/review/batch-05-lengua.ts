/**
 * Batch 05, lengua castellana, Cicle Mitjà (difficulty 1 and 2).
 *
 * A draft: nothing here ships. Approved entries are moved into
 * src/fallback/bank/lengua.es.ts. Run
 * `npx tsx content/tools/review-sheet.ts 05-lengua` to validate the batch and
 * regenerate batch-05-lengua.md.
 */

import type { Question } from '../../src/quiz/schema.js';
import type { BatchRef } from './batch-01-medio.js';

const LOCATE = 'Texto propio. Proceso "localizar y obtener información" del marco de 4t 2026';
const INFER = 'Texto propio. Proceso "realizar inferencias directas" del marco de 4t 2026';
const INTEGRATE = 'Texto propio. Proceso "integrar e interpretar ideas" del marco de 4t 2026';
const SCHOOL = 'Contenido escolar estándar';
const RAE = 'Ortografía de la lengua española (RAE)';

export const QUESTIONS: Question[] = [
  // ---- Single-select ----
  {
    id: 'len-ss-11', type: 'singleSelect',
    prompt: 'Lee: "Marta olvidó el paraguas en casa y llegó al colegio empapada." ¿Qué tiempo hacía?',
    options: ['Llovía', 'Hacía sol', 'Nevaba', 'Hacía viento'], correctIndex: 0,
    explanation: 'Si echó de menos el paraguas y llegó empapada, es que llovía.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 1 },
  },
  {
    id: 'len-ss-12', type: 'singleSelect',
    prompt: 'Lee: "El tren a Girona sale a las 9:30 del andén 4. El viaje dura una hora." ¿De qué andén sale el tren?',
    options: ['Del 9', 'Del 1', 'Del 4', 'Del 30'], correctIndex: 2,
    explanation: 'El texto dice que el tren sale "del andén 4". Las 9:30 son la hora de salida.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 1 },
  },
  {
    id: 'len-ss-13', type: 'singleSelect',
    prompt: 'Lee: "Pablo miró el reloj, cogió la mochila sin desayunar y salió corriendo hacia la parada." ¿Qué le pasaba a Pablo?',
    options: ['Tenía hambre', 'Estaba enfermo', 'Iba de excursión', 'Llegaba tarde'], correctIndex: 3,
    explanation: 'Mirar el reloj, no desayunar y salir corriendo son pistas de que llegaba tarde.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ss-14', type: 'singleSelect',
    prompt: 'Lee: "Las abejas visitan las flores para recoger néctar. Al hacerlo, llevan polen de una flor a otra y ayudan a que nazcan frutos." ¿Cuál es la idea principal?',
    options: ['Las abejas ayudan a las plantas', 'Las flores tienen colores vivos', 'El néctar es muy dulce', 'Los frutos nacen en verano'], correctIndex: 0,
    explanation: 'Todo el texto explica cómo las abejas, al llevar el polen, ayudan a que las plantas den frutos.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ss-15', type: 'singleSelect',
    prompt: 'Lee: "Aviso: la biblioteca cerrará el viernes por obras. Los libros se podrán devolver el lunes sin recargo." ¿Qué puedes hacer el lunes?',
    options: ['Pedir un carné nuevo', 'Visitar las obras', 'Devolver los libros', 'Cerrar la biblioteca'], correctIndex: 2,
    explanation: 'El aviso dice que los libros se podrán devolver el lunes sin recargo.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ss-16', type: 'singleSelect',
    prompt: 'Lee: "Lucía guardó la carta en el cajón con una sonrisa enorme." ¿Cómo se sentía Lucía?',
    options: ['Enfadada', 'Asustada', 'Aburrida', 'Contenta'], correctIndex: 3,
    explanation: 'La sonrisa enorme nos dice que la carta la puso contenta.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ss-17', type: 'singleSelect',
    prompt: '¿Cuál de estas frases es una opinión?',
    options: ['Un partido dura 90 minutos', 'El fútbol es el mejor deporte', 'Cada equipo tiene 11 jugadores', 'El balón es redondo'], correctIndex: 1,
    explanation: 'Decir que algo es "el mejor" es una opinión: otra persona puede pensar distinto. Las otras frases se pueden comprobar.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ss-18', type: 'singleSelect',
    prompt: '¿Para qué sirve un anuncio publicitario?',
    options: ['Para contar un cuento', 'Para dar una noticia', 'Para explicar una receta', 'Para convencer de comprar algo'], correctIndex: 3,
    explanation: 'Un anuncio quiere convencerte de que compres o hagas algo.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ss-19', type: 'singleSelect',
    prompt: '¿Qué tipo de texto se escribe en versos y suele tener rima?',
    options: ['La noticia', 'La receta', 'El poema', 'La carta'], correctIndex: 2,
    explanation: 'El poema se escribe en versos, que a menudo riman entre sí.',
    meta: { subject: 'lengua', topic: 'literatura', difficulty: 1 },
  },
  {
    id: 'len-ss-20', type: 'singleSelect',
    prompt: 'En la portada de un libro pone "Ilustraciones de Ana Ruiz". ¿Qué ha hecho Ana Ruiz?',
    options: ['Escribir el texto', 'Vender el libro', 'Traducir el libro', 'Hacer los dibujos'], correctIndex: 3,
    explanation: 'Las ilustraciones son los dibujos del libro, y quien los hace es el ilustrador o la ilustradora.',
    meta: { subject: 'lengua', topic: 'literatura', difficulty: 2 },
  },
  {
    id: 'len-ss-21', type: 'singleSelect',
    prompt: '¿Qué palabra está bien escrita?',
    options: ['Havía', 'Abía', 'Había', 'Habia'], correctIndex: 2,
    explanation: '"Había" se escribe con h, con b y con tilde en la í.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 1 },
  },
  {
    id: 'len-ss-22', type: 'singleSelect',
    prompt: '¿Qué palabra se escribe con "g"?',
    options: ['_irasol', '_abón', '_ugar', '_efe'], correctIndex: 0,
    explanation: '"Girasol" se escribe con g. "Jabón", "jugar" y "jefe" se escriben con j.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 2 },
  },
  {
    id: 'len-ss-23', type: 'singleSelect',
    prompt: '¿Qué signos se usan en una frase que expresa sorpresa, como "Qué susto"?',
    options: ['¿ ?', '¡ !', '" "', '( )'], correctIndex: 1,
    explanation: 'Los signos de exclamación (¡ !) se usan para expresar sorpresa, alegría o enfado: ¡Qué susto!',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 1 },
  },
  {
    id: 'len-ss-24', type: 'singleSelect',
    prompt: '¿Qué tipo de oración es "¿Vienes mañana al parque?"?',
    options: ['Enunciativa', 'Exclamativa', 'Interrogativa', 'Imperativa'], correctIndex: 2,
    explanation: 'Una oración interrogativa hace una pregunta y lleva signos de interrogación.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },
  {
    id: 'len-ss-25', type: 'singleSelect',
    prompt: '¿En qué frase están bien puestas las comas?',
    options: ['Compré, pan leche y huevos.', 'Compré pan leche, y huevos.', 'Compré pan, leche, y, huevos.', 'Compré pan, leche y huevos.'], correctIndex: 3,
    explanation: 'En una lista, las comas separan los elementos, menos el último, que va unido con "y".',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 2 },
  },
  {
    id: 'len-ss-26', type: 'singleSelect',
    prompt: '¿Qué palabra pertenece a la familia de "pan"?',
    options: ['Panadero', 'Pantalón', 'Pandilla', 'Pantera'], correctIndex: 0,
    explanation: '"Panadero" viene de "pan". Las otras palabras solo empiezan igual, pero no tienen que ver con el pan.',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
  },
  {
    id: 'len-ss-27', type: 'singleSelect',
    prompt: 'En la frase "Me senté en un banco del parque", ¿qué significa "banco"?',
    options: ['Un grupo de peces', 'Un lugar para guardar dinero', 'Un asiento', 'Una mesa de trabajo'], correctIndex: 2,
    explanation: '"Banco" tiene varios significados. Aquí es un asiento, porque la frase habla de sentarse en el parque.',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 2 },
  },

  // ---- Multi-select ----
  {
    id: 'len-ms-05', type: 'multiSelect',
    prompt: 'Lee: "El zorro rojo vive en bosques y campos de Europa. Caza de noche y come ratones, frutos e insectos." ¿Qué afirmaciones son verdaderas según el texto?',
    options: ['Vive en Europa', 'Caza de día', 'Come frutos', 'Solo come carne', 'Caza de noche'], correctIndices: [0, 2, 4],
    explanation: 'El texto dice que vive en Europa, que caza de noche y que come ratones, frutos e insectos.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ms-06', type: 'multiSelect',
    prompt: 'Lee: "Receta: mezcla la harina con los huevos, añade la leche poco a poco y cuece la masa en una sartén caliente." ¿Qué ingredientes lleva la receta?',
    options: ['Harina', 'Azúcar', 'Huevos', 'Leche', 'Aceite'], correctIndices: [0, 2, 3],
    explanation: 'La receta nombra harina, huevos y leche. No habla de azúcar ni de aceite.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ms-07', type: 'multiSelect',
    prompt: '¿Cuáles de estas frases son hechos, y no opiniones?',
    options: ['Madrid es la capital de España', 'El verano es la mejor estación', 'Una semana tiene siete días', 'Los gatos son más listos', 'El agua hierve a 100 grados'], correctIndices: [0, 2, 4],
    explanation: 'Un hecho se puede comprobar. Que algo sea "mejor" o "más listo" depende de quien opina.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 2 },
  },
  {
    id: 'len-ms-08', type: 'multiSelect',
    prompt: '¿Cuáles de estas palabras deben empezar con mayúscula?',
    options: ['barcelona', 'mesa', 'lucía', 'ebro', 'perro'], correctIndices: [0, 2, 3],
    explanation: 'Los nombres propios de ciudades (Barcelona), personas (Lucía) y ríos (Ebro) empiezan con mayúscula.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 1 },
  },
  {
    id: 'len-ms-09', type: 'multiSelect',
    prompt: '¿Cuáles de estas palabras son verbos?',
    options: ['Saltar', 'Mesa', 'Comer', 'Azul', 'Escribir'], correctIndices: [0, 2, 4],
    explanation: 'Saltar, comer y escribir son acciones, así que son verbos. "Mesa" es un sustantivo y "azul" un adjetivo.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },

  // ---- Typed ----
  {
    id: 'len-ty-05', type: 'typed',
    prompt: 'Lee: "El autobús de la excursión saldrá el jueves a las ocho de la puerta del colegio." ¿Qué día sale el autobús?',
    expectedConcept: 'jueves', keywords: ['jueves'],
    exampleAnswers: ['Jueves', 'El jueves', 'Sale el jueves'],
    fallbackMultipleChoice: {
      id: 'len-ty-05-mc', type: 'singleSelect',
      prompt: 'Lee: "El autobús de la excursión saldrá el jueves a las ocho de la puerta del colegio." ¿Qué día sale el autobús?',
      options: ['El lunes', 'El martes', 'El jueves', 'El viernes'], correctIndex: 2,
      explanation: 'El texto dice que el autobús "saldrá el jueves".',
      meta: { subject: 'lengua', topic: 'comprension', difficulty: 1 },
    },
    explanation: 'El texto dice que el autobús "saldrá el jueves".',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 1 },
  },
  {
    id: 'len-ty-06', type: 'typed',
    prompt: '¿Cómo se llama el personaje principal de un cuento?',
    expectedConcept: 'protagonista', keywords: ['protagonista'],
    exampleAnswers: ['Protagonista', 'El protagonista', 'La protagonista'],
    fallbackMultipleChoice: {
      id: 'len-ty-06-mc', type: 'singleSelect',
      prompt: '¿Cómo se llama el personaje principal de un cuento?',
      options: ['Narrador', 'Protagonista', 'Autor', 'Ilustrador'], correctIndex: 1,
      explanation: 'El protagonista es el personaje más importante: la historia cuenta lo que le pasa.',
      meta: { subject: 'lengua', topic: 'literatura', difficulty: 1 },
    },
    explanation: 'El protagonista es el personaje más importante: la historia cuenta lo que le pasa.',
    meta: { subject: 'lengua', topic: 'literatura', difficulty: 1 },
  },
  {
    id: 'len-ty-07', type: 'typed',
    prompt: '¿Cómo se llama la persona que escribe un libro?',
    expectedConcept: 'autor', keywords: ['autor'],
    exampleAnswers: ['Autor', 'El autor', 'Autora', 'La autora', 'Escritor', 'El escritor', 'Escritora', 'La escritora'],
    fallbackMultipleChoice: {
      id: 'len-ty-07-mc', type: 'singleSelect',
      prompt: '¿Cómo se llama la persona que escribe un libro?',
      options: ['El lector', 'El editor', 'El librero', 'El autor'], correctIndex: 3,
      explanation: 'Quien escribe un libro es su autor o autora. El lector lo lee, el editor lo publica y el librero lo vende.',
      meta: { subject: 'lengua', topic: 'literatura', difficulty: 2 },
    },
    explanation: 'Quien escribe un libro es su autor o autora. El lector lo lee, el editor lo publica y el librero lo vende.',
    meta: { subject: 'lengua', topic: 'literatura', difficulty: 2 },
  },
  {
    id: 'len-ty-08', type: 'typed',
    prompt: 'La palabra "uevo" tiene una falta de ortografía. Escríbela bien.',
    expectedConcept: 'huevo', keywords: ['huevo'],
    exampleAnswers: ['Huevo', 'Se escribe huevo', 'Es huevo'],
    fallbackMultipleChoice: {
      id: 'len-ty-08-mc', type: 'singleSelect',
      prompt: 'La palabra "uevo" tiene una falta de ortografía. ¿Cómo se escribe bien?',
      options: ['Huevo', 'Uebo', 'Huebo', 'Guevo'], correctIndex: 0,
      explanation: '"Huevo" se escribe con h y con v. Las palabras que empiezan por "hue" llevan h.',
      meta: { subject: 'lengua', topic: 'ortografia', difficulty: 2 },
    },
    explanation: '"Huevo" se escribe con h y con v. Las palabras que empiezan por "hue" llevan h.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 2 },
  },
  {
    id: 'len-ty-09', type: 'typed',
    prompt: '¿Cuál es el antónimo de "abrir"?',
    expectedConcept: 'cerrar', keywords: ['cerrar'],
    exampleAnswers: ['Cerrar', 'Es cerrar', 'El antónimo es cerrar'],
    fallbackMultipleChoice: {
      id: 'len-ty-09-mc', type: 'singleSelect',
      prompt: '¿Cuál es el antónimo de "abrir"?',
      options: ['Empujar', 'Cerrar', 'Entrar', 'Romper'], correctIndex: 1,
      explanation: 'Un antónimo es una palabra que significa lo contrario. Lo contrario de abrir es cerrar.',
      meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
    },
    explanation: 'Un antónimo es una palabra que significa lo contrario. Lo contrario de abrir es cerrar.',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
  },
];

export const REFS: Record<string, BatchRef> = {
  'len-ss-11': { row: 'L1', source: INFER },
  'len-ss-12': { row: 'L1', source: LOCATE },
  'len-ss-13': { row: 'L1', source: INFER },
  'len-ss-14': { row: 'L1', source: INTEGRATE },
  'len-ss-15': { row: 'L1', source: LOCATE },
  'len-ss-16': { row: 'L1', source: INFER },
  'len-ss-17': { row: 'L2', source: 'Decret 175/2022, distinción entre hechos y opiniones' },
  'len-ss-18': { row: 'L2', source: SCHOOL },
  'len-ss-19': { row: 'L3', source: SCHOOL },
  'len-ss-20': { row: 'L3', source: 'Decret 175/2022, datos básicos de un libro' },
  'len-ss-21': { row: 'L4', source: RAE },
  'len-ss-22': { row: 'L4', source: RAE },
  'len-ss-23': { row: 'L5', source: RAE },
  'len-ss-24': { row: 'L5', source: SCHOOL },
  'len-ss-25': { row: 'L5', source: RAE },
  'len-ss-26': { row: 'L7', source: SCHOOL },
  'len-ss-27': { row: 'L7', source: SCHOOL },
  'len-ms-05': { row: 'L1', source: LOCATE },
  'len-ms-06': { row: 'L1', source: LOCATE },
  'len-ms-07': { row: 'L2', source: 'Decret 175/2022, distinción entre hechos y opiniones' },
  'len-ms-08': { row: 'L4', source: RAE },
  'len-ms-09': { row: 'L6', source: SCHOOL },
  'len-ty-05': { row: 'L1', source: LOCATE },
  'len-ty-06': { row: 'L3', source: SCHOOL },
  'len-ty-07': { row: 'L3', source: SCHOOL },
  'len-ty-08': { row: 'L4', source: RAE },
  'len-ty-09': { row: 'L7', source: SCHOOL },
};
