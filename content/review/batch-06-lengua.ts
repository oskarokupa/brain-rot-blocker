/**
 * Batch 06, lengua castellana, Cicle Superior (difficulty 3).
 *
 * A draft: nothing here ships. Approved entries are moved into
 * src/fallback/bank/lengua.es.ts. Run
 * `npx tsx content/tools/review-sheet.ts 06-lengua` to validate the batch and
 * regenerate batch-06-lengua.md.
 */

import type { Question } from '../../src/quiz/schema.js';
import type { BatchRef } from './batch-01-medio.js';

const INFER = 'Texto propio. Inferencia, al nivel de la prueba de castellano de 6è 2025';
const MAIN = 'Texto propio. Idea principal, al nivel de la prueba de castellano de 6è 2025';
const SCHOOL = 'Contenido escolar estándar';
const RAE = 'Ortografía de la lengua española (RAE)';
const INFO = 'Decret 175/2022, hechos, opiniones y manipulación informativa';

export const QUESTIONS: Question[] = [
  // ---- Single-select ----
  {
    id: 'len-ss-28', type: 'singleSelect',
    prompt: 'Lee: "Durante siglos, los faros guiaron a los barcos de noche. Hoy los barcos usan satélites, pero muchos faros siguen encendidos como señal de seguridad." ¿Cuál es la idea principal?',
    options: ['Los faros ya no sirven para nada', 'Los faros siguen en uso aunque hay satélites', 'Los barcos solo navegan de noche', 'Los satélites son más antiguos que los faros'], correctIndex: 1,
    explanation: 'El texto cuenta que, aunque hoy existen los satélites, muchos faros siguen encendidos.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ss-29', type: 'singleSelect',
    prompt: 'Lee: "Cuando Íker abrió la nevera, suspiró. Solo quedaban medio limón y un yogur caducado. Cogió las llaves y la bolsa de tela." ¿Qué va a hacer Íker?',
    options: ['Ir a comprar comida', 'Cocinar una cena', 'Tirar la nevera', 'Irse de viaje'], correctIndex: 0,
    explanation: 'La nevera está casi vacía y coge las llaves y una bolsa de tela: va a comprar comida.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ss-30', type: 'singleSelect',
    prompt: 'Lee: "El guepardo alcanza los 100 km/h, pero solo aguanta esa velocidad unos segundos. Si no atrapa a su presa enseguida, abandona la caza." ¿Por qué abandona la caza?',
    options: ['Porque no tiene hambre', 'Porque es un animal lento', 'Porque caza solo de noche', 'Porque se cansa muy rápido'], correctIndex: 3,
    explanation: 'El texto dice que solo aguanta esa velocidad unos segundos, es decir, se cansa enseguida.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ss-31', type: 'singleSelect',
    prompt: 'Lee: "Aunque el examen era difícil, Sara salió del aula tarareando una canción." ¿Qué podemos deducir?',
    options: ['Que no hizo el examen', 'Que estaba muy preocupada', 'Que el examen le fue bien', 'Que llegó tarde a clase'], correctIndex: 2,
    explanation: 'Quien sale tarareando está de buen humor. Eso nos hace pensar que, aunque era difícil, el examen le fue bien.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ss-32', type: 'singleSelect',
    prompt: 'Quieres saber cuántos habitantes tiene tu ciudad. ¿Cuál es la fuente más fiable?',
    options: ['Un comentario en un vídeo', 'Un mensaje reenviado', 'Un anuncio de zapatillas', 'La web del ayuntamiento'], correctIndex: 3,
    explanation: 'La web del ayuntamiento es una fuente oficial. En un comentario o en un mensaje reenviado no sabes quién lo dice ni de dónde saca el dato.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ss-33', type: 'singleSelect',
    prompt: 'Un titular dice: "¡Este truco increíble te hará sacar un 10 sin estudiar!". ¿Qué deberías pensar?',
    options: ['Que es cierto porque está publicado', 'Que busca llamar la atención y puede ser falso', 'Que lo ha escrito un profesor', 'Que es una noticia científica'], correctIndex: 1,
    explanation: 'Un titular que promete algo demasiado bueno busca que hagas clic. Conviene desconfiar y comprobarlo en otra fuente.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ss-34', type: 'singleSelect',
    prompt: 'Completa: "Quería ir al cine, ___ tenía que estudiar."',
    options: ['pero', 'porque', 'además', 'entonces'], correctIndex: 0,
    explanation: '"Pero" une dos ideas que se oponen: querer ir al cine y tener que estudiar.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 3 },
  },
  {
    id: 'len-ss-35', type: 'singleSelect',
    prompt: 'En la frase "Ana vio a Luis y lo saludó", ¿a quién se refiere "lo"?',
    options: ['A Ana', 'A los dos', 'A Luis', 'A nadie'], correctIndex: 2,
    explanation: '"Lo" sustituye a Luis para no repetir su nombre: Ana saludó a Luis.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 3 },
  },
  {
    id: 'len-ss-36', type: 'singleSelect',
    prompt: '¿Cuál de estas palabras es esdrújula?',
    options: ['Camión', 'Árbol', 'Pájaro', 'Reloj'], correctIndex: 2,
    explanation: '"Pájaro" lleva la fuerza en la antepenúltima sílaba (PÁ-ja-ro), así que es esdrújula. Todas las esdrújulas llevan tilde.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 3 },
  },
  {
    id: 'len-ss-37', type: 'singleSelect',
    prompt: '¿Por qué lleva tilde la palabra "camión"?',
    options: ['Porque es aguda y acaba en n', 'Porque es llana y acaba en n', 'Porque es esdrújula', 'Porque tiene tres sílabas'], correctIndex: 0,
    explanation: 'Las palabras agudas llevan tilde cuando acaban en vocal, en n o en s. "Camión" es aguda y acaba en n.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 3 },
  },
  {
    id: 'len-ss-38', type: 'singleSelect',
    prompt: 'En un poema se lee: "Sus ojos eran como dos luceros". ¿Qué recurso literario es?',
    options: ['Una rima', 'Una personificación', 'Un diálogo', 'Una comparación'], correctIndex: 3,
    explanation: 'Es una comparación: relaciona los ojos con los luceros usando la palabra "como".',
    meta: { subject: 'lengua', topic: 'literatura', difficulty: 3 },
  },
  {
    id: 'len-ss-39', type: 'singleSelect',
    prompt: '¿Qué significa el prefijo "sub-" en la palabra "submarino"?',
    options: ['Encima de', 'Antes de', 'Lejos de', 'Debajo de'], correctIndex: 3,
    explanation: '"Sub-" significa "debajo de". Un submarino navega por debajo del mar.',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 3 },
  },

  // ---- Multi-select ----
  {
    id: 'len-ms-10', type: 'multiSelect',
    prompt: 'Lee: "El Camino de Santiago es una ruta que miles de personas recorren cada año a pie, en bici o a caballo. Termina en Santiago de Compostela, en Galicia." ¿Qué afirmaciones son verdaderas según el texto?',
    options: ['Se puede hacer en bicicleta', 'Termina en Galicia', 'Solo se puede hacer a pie', 'Lo recorre poca gente', 'Se puede hacer a caballo'], correctIndices: [0, 1, 4],
    explanation: 'El texto dice que se recorre a pie, en bici o a caballo, que lo hacen miles de personas y que termina en Galicia.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ms-11', type: 'multiSelect',
    prompt: '¿Cuáles de estas frases sobre una película son opiniones?',
    options: ['Esta película es aburridísima', 'La película dura dos horas', 'El protagonista actúa fatal', 'Se estrenó el año pasado', 'La música es preciosa'], correctIndices: [0, 2, 4],
    explanation: '"Aburridísima", "actúa fatal" y "preciosa" son valoraciones personales. La duración y la fecha de estreno son hechos que se pueden comprobar.',
    meta: { subject: 'lengua', topic: 'comprension', difficulty: 3 },
  },
  {
    id: 'len-ms-12', type: 'multiSelect',
    prompt: '¿Cuáles de estas palabras son agudas?',
    options: ['Sofá', 'Mesa', 'Reloj', 'Lápiz', 'Canción'], correctIndices: [0, 2, 4],
    explanation: 'Sofá, reloj y canción llevan la fuerza en la última sílaba. Mesa y lápiz son llanas.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 3 },
  },
  {
    id: 'len-ms-13', type: 'multiSelect',
    prompt: '¿Cuáles de estas son palabras compuestas, formadas al unir dos palabras?',
    options: ['Sacapuntas', 'Ventana', 'Paraguas', 'Zapato', 'Girasol'], correctIndices: [0, 2, 4],
    explanation: 'Sacapuntas (saca + puntas), paraguas (para + aguas) y girasol (gira + sol) están formadas por dos palabras.',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 3 },
  },

  // ---- Typed ----
  {
    id: 'len-ty-10', type: 'typed',
    prompt: '¿En qué tiempo verbal está la frase "Mañana iremos a la playa"?',
    expectedConcept: 'futuro', keywords: ['futuro'],
    exampleAnswers: ['Futuro', 'En futuro', 'El futuro', 'Tiempo futuro'],
    fallbackMultipleChoice: {
      id: 'len-ty-10-mc', type: 'singleSelect',
      prompt: '¿En qué tiempo verbal está la frase "Mañana iremos a la playa"?',
      options: ['Pasado', 'Presente', 'Futuro', 'Condicional'], correctIndex: 2,
      explanation: '"Iremos" habla de algo que todavía no ha pasado, así que está en futuro.',
      meta: { subject: 'lengua', topic: 'gramatica', difficulty: 3 },
    },
    explanation: '"Iremos" habla de algo que todavía no ha pasado, así que está en futuro.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 3 },
  },
  {
    id: 'len-ty-11', type: 'typed',
    prompt: 'Cambia "yo canto" al pasado. Empieza por "yo".',
    expectedConcept: 'yo canté', keywords: ['cante'],
    exampleAnswers: ['Yo canté', 'Canté', 'Yo cantaba', 'Cantaba', 'Yo he cantado', 'He cantado'],
    fallbackMultipleChoice: {
      id: 'len-ty-11-mc', type: 'singleSelect',
      prompt: '¿Cuál de estas formas de "cantar" está en pasado?',
      options: ['Yo cantaré', 'Yo canto', 'Yo cantaría', 'Yo canté'], correctIndex: 3,
      explanation: '"Yo canté" está en pasado. "Yo canto" es presente y "yo cantaré" es futuro.',
      meta: { subject: 'lengua', topic: 'gramatica', difficulty: 3 },
    },
    explanation: '"Yo canté" está en pasado. "Yo canto" es presente y "yo cantaré" es futuro.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 3 },
  },
  {
    id: 'len-ty-12', type: 'typed',
    prompt: '¿Cómo se llaman las palabras que llevan la fuerza en la última sílaba, como "café"?',
    expectedConcept: 'agudas', keywords: ['agudas'],
    exampleAnswers: ['Agudas', 'Palabras agudas', 'Aguda', 'Son agudas'],
    fallbackMultipleChoice: {
      id: 'len-ty-12-mc', type: 'singleSelect',
      prompt: '¿Cómo se llaman las palabras que llevan la fuerza en la última sílaba, como "café"?',
      options: ['Agudas', 'Llanas', 'Esdrújulas', 'Compuestas'], correctIndex: 0,
      explanation: 'Las palabras agudas llevan la fuerza en la última sílaba: ca-FÉ.',
      meta: { subject: 'lengua', topic: 'ortografia', difficulty: 3 },
    },
    explanation: 'Las palabras agudas llevan la fuerza en la última sílaba: ca-FÉ.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 3 },
  },
  {
    id: 'len-ty-13', type: 'typed',
    prompt: 'En "El viento susurraba secretos" se dan cualidades humanas al viento. ¿Cómo se llama este recurso literario?',
    expectedConcept: 'personificación', keywords: ['personificacion'],
    exampleAnswers: ['Personificación', 'La personificación', 'Una personificación'],
    fallbackMultipleChoice: {
      id: 'len-ty-13-mc', type: 'singleSelect',
      prompt: 'En "El viento susurraba secretos" se dan cualidades humanas al viento. ¿Cómo se llama este recurso literario?',
      options: ['Comparación', 'Personificación', 'Exageración', 'Repetición'], correctIndex: 1,
      explanation: 'La personificación da cualidades de persona a animales o cosas. El viento no puede susurrar secretos de verdad.',
      meta: { subject: 'lengua', topic: 'literatura', difficulty: 3 },
    },
    explanation: 'La personificación da cualidades de persona a animales o cosas. El viento no puede susurrar secretos de verdad.',
    meta: { subject: 'lengua', topic: 'literatura', difficulty: 3 },
  },
];

export const REFS: Record<string, BatchRef> = {
  'len-ss-28': { row: 'L8', source: MAIN },
  'len-ss-29': { row: 'L8', source: INFER },
  'len-ss-30': { row: 'L8', source: INFER },
  'len-ss-31': { row: 'L8', source: INFER },
  'len-ss-32': { row: 'L9', source: 'Decret 175/2022, fiabilidad de las fuentes' },
  'len-ss-33': { row: 'L9', source: INFO },
  'len-ss-34': { row: 'L10', source: 'Decret 175/2022, conectores como mecanismo de cohesión' },
  'len-ss-35': { row: 'L10', source: 'Decret 175/2022, sustituciones pronominales' },
  'len-ss-36': { row: 'L11', source: RAE },
  'len-ss-37': { row: 'L11', source: RAE },
  'len-ss-38': { row: 'L12', source: SCHOOL },
  'len-ss-39': { row: 'L13', source: SCHOOL },
  'len-ms-10': { row: 'L8', source: 'Texto propio. Localizar información en un texto informativo' },
  'len-ms-11': { row: 'L9', source: INFO },
  'len-ms-12': { row: 'L11', source: RAE },
  'len-ms-13': { row: 'L13', source: SCHOOL },
  'len-ty-10': { row: 'L10', source: SCHOOL },
  'len-ty-11': { row: 'L10', source: SCHOOL },
  'len-ty-12': { row: 'L11', source: RAE },
  'len-ty-13': { row: 'L12', source: SCHOOL },
};
