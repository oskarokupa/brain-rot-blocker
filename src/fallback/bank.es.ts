/**
 * The offline fallback question bank. Spain Primary Year 4 level, Spanish.
 *
 * Used whenever a video has no usable transcript, or the LLM is unreachable.
 * Entirely self-contained: no network, no API key, works with the computer
 * unplugged from the internet.
 *
 * Written as typed data rather than a bare .json file on purpose: TypeScript
 * catches a malformed entry (wrong option count, a multiSelect with every
 * option marked correct) at build time, before validate.ts ever has to.
 *
 * Seed content. The SOP's target is 150 to 200 questions; this is 36, enough
 * to exercise every question type and the selection logic end to end. Growing
 * the bank is content work, not an engineering gap, and does not touch any of
 * the code that selects from it.
 */

import type { Question } from '../quiz/schema.js';

export const FALLBACK_BANK_ES: Question[] = [
  // ---- Matemáticas: single-select ----
  {
    id: 'mat-ss-01', type: 'singleSelect',
    prompt: '¿Cuánto es 6 x 7?',
    options: ['36', '42', '48', '45'], correctIndex: 1,
    explanation: '6 x 7 es 42.',
    meta: { subject: 'matematicas', topic: 'multiplicacion', difficulty: 1 },
  },
  {
    id: 'mat-ss-02', type: 'singleSelect',
    prompt: '¿Cuánto es 72 ÷ 8?',
    options: ['9', '8', '7', '6'], correctIndex: 0,
    explanation: '72 entre 8 es 9, porque 9 x 8 = 72.',
    meta: { subject: 'matematicas', topic: 'division', difficulty: 1 },
  },
  {
    id: 'mat-ss-03', type: 'singleSelect',
    prompt: '¿Qué fracción es mayor, 1/2 o 1/4?',
    options: ['1/2', '1/4', 'Iguales', 'No lo sé'], correctIndex: 0,
    explanation: 'Cuanto más pequeño es el número de abajo, más grande es cada parte. Por eso 1/2 es mayor que 1/4.',
    meta: { subject: 'matematicas', topic: 'fracciones', difficulty: 2 },
  },
  {
    id: 'mat-ss-04', type: 'singleSelect',
    prompt: 'Un metro tiene cuántos centímetros?',
    options: ['10', '100', '1000', '50'], correctIndex: 1,
    explanation: 'Un metro equivale a 100 centímetros.',
    meta: { subject: 'matematicas', topic: 'medidas', difficulty: 1 },
  },
  {
    id: 'mat-ss-05', type: 'singleSelect',
    prompt: '¿Cuántos lados tiene un hexágono?',
    options: ['5', '6', '7', '8'], correctIndex: 1,
    explanation: 'Un hexágono tiene 6 lados.',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 1 },
  },
  {
    id: 'mat-ss-06', type: 'singleSelect',
    prompt: 'Si tienes 24 caramelos y los repartes entre 4 amigos por igual, ¿cuántos le tocan a cada uno?',
    options: ['4', '8', '6', '5'], correctIndex: 2,
    explanation: '24 entre 4 es 6 caramelos para cada amigo.',
    meta: { subject: 'matematicas', topic: 'division', difficulty: 2 },
  },
  {
    id: 'mat-ss-07', type: 'singleSelect',
    prompt: '¿Cuál es el resultado de 15 + 28?',
    options: ['33', '43', '53', '42'], correctIndex: 1,
    explanation: '15 más 28 es 43.',
    meta: { subject: 'matematicas', topic: 'operaciones', difficulty: 1 },
  },
  {
    id: 'mat-ss-08', type: 'singleSelect',
    prompt: '¿Qué figura tiene los cuatro lados iguales y los cuatro ángulos rectos?',
    options: ['Rectángulo', 'Cuadrado', 'Triángulo', 'Rombo'], correctIndex: 1,
    explanation: 'El cuadrado tiene cuatro lados iguales y cuatro ángulos rectos.',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 2 },
  },
  {
    id: 'mat-ss-09', type: 'singleSelect',
    prompt: 'Ana tiene 50 euros y gasta 18. ¿Cuánto le queda?',
    options: ['42', '32', '22', '38'], correctIndex: 1,
    explanation: '50 menos 18 es 32 euros.',
    meta: { subject: 'matematicas', topic: 'operaciones', difficulty: 2 },
  },
  {
    id: 'mat-ss-10', type: 'singleSelect',
    prompt: '¿Cuánto es la mitad de 90?',
    options: ['40', '45', '50', '35'], correctIndex: 1,
    explanation: 'La mitad de 90 es 45.',
    meta: { subject: 'matematicas', topic: 'fracciones', difficulty: 2 },
  },

  // ---- Matemáticas: multi-select ----
  {
    id: 'mat-ms-01', type: 'multiSelect',
    prompt: '¿Cuáles de estos números son múltiplos de 5?',
    options: ['20', '13', '35', '42', '50'], correctIndices: [0, 2, 4],
    explanation: '20, 35 y 50 se pueden dividir entre 5 sin que sobre nada.',
    meta: { subject: 'matematicas', topic: 'multiplos', difficulty: 2 },
  },
  {
    id: 'mat-ms-02', type: 'multiSelect',
    prompt: '¿Cuáles de estas figuras tienen al menos un ángulo recto?',
    options: ['Cuadrado', 'Óvalo', 'Rectángulo', 'Círculo', 'Rombo'], correctIndices: [0, 2],
    explanation: 'El cuadrado y el rectángulo tienen ángulos rectos. El óvalo, el círculo y el rombo no.',
    meta: { subject: 'matematicas', topic: 'geometria', difficulty: 2 },
  },
  {
    id: 'mat-ms-03', type: 'multiSelect',
    prompt: '¿Cuáles de estas cantidades son mayores que 100?',
    options: ['99', '150', '100', '230', '85'], correctIndices: [1, 3],
    explanation: '150 y 230 son mayores que 100. 99, 100 y 85 no lo son.',
    meta: { subject: 'matematicas', topic: 'comparacion', difficulty: 1 },
  },
  {
    id: 'mat-ms-04', type: 'multiSelect',
    prompt: '¿Cuáles de estos números son pares?',
    options: ['14', '21', '36', '47', '58'], correctIndices: [0, 2, 4],
    explanation: '14, 36 y 58 terminan en una cifra par.',
    meta: { subject: 'matematicas', topic: 'numeracion', difficulty: 1 },
  },

  // ---- Matemáticas: typed ----
  {
    id: 'mat-ty-01', type: 'typed',
    prompt: '¿Cuánto es 9 x 6?',
    expectedConcept: '54', keywords: ['54', 'cincuenta y cuatro'],
    exampleAnswers: ['54', 'cincuenta y cuatro', 'Es 54'],
    fallbackMultipleChoice: {
      id: 'mat-ty-01-mc', type: 'singleSelect',
      prompt: '¿Cuánto es 9 x 6?',
      options: ['56', '54', '45', '63'], correctIndex: 1,
      explanation: '9 x 6 es 54.',
      meta: { subject: 'matematicas', topic: 'multiplicacion', difficulty: 1 },
    },
    explanation: '9 x 6 es 54.',
    meta: { subject: 'matematicas', topic: 'multiplicacion', difficulty: 1 },
  },
  {
    id: 'mat-ty-02', type: 'typed',
    prompt: '¿Cuántos días tiene el mes de abril?',
    expectedConcept: '30', keywords: ['30', 'treinta'],
    exampleAnswers: ['30', 'treinta', 'Tiene 30 días'],
    fallbackMultipleChoice: {
      id: 'mat-ty-02-mc', type: 'singleSelect',
      prompt: '¿Cuántos días tiene el mes de abril?',
      options: ['30', '31', '28', '29'], correctIndex: 0,
      explanation: 'Abril tiene 30 días.',
      meta: { subject: 'matematicas', topic: 'medidas', difficulty: 1 },
    },
    explanation: 'Abril tiene 30 días.',
    meta: { subject: 'matematicas', topic: 'medidas', difficulty: 1 },
  },
  {
    id: 'mat-ty-03', type: 'typed',
    prompt: '¿Cuál es el doble de 23?',
    expectedConcept: '46', keywords: ['46', 'cuarenta y seis'],
    exampleAnswers: ['46', 'cuarenta y seis', 'Es 46'],
    fallbackMultipleChoice: {
      id: 'mat-ty-03-mc', type: 'singleSelect',
      prompt: '¿Cuál es el doble de 23?',
      options: ['45', '46', '48', '44'], correctIndex: 1,
      explanation: 'El doble de 23 es 46.',
      meta: { subject: 'matematicas', topic: 'operaciones', difficulty: 2 },
    },
    explanation: 'El doble de 23 es 46.',
    meta: { subject: 'matematicas', topic: 'operaciones', difficulty: 2 },
  },
  {
    id: 'mat-ty-04', type: 'typed',
    prompt: 'Un tren sale a las 14:00 y el viaje dura 2 horas. ¿A qué hora llega?',
    expectedConcept: '16:00', keywords: ['16', 'dieciseis', 'cuatro de la tarde'],
    exampleAnswers: ['16:00', 'A las 16:00', 'Las cuatro de la tarde'],
    fallbackMultipleChoice: {
      id: 'mat-ty-04-mc', type: 'singleSelect',
      prompt: 'Un tren sale a las 14:00 y el viaje dura 2 horas. ¿A qué hora llega?',
      options: ['16:00', '14:00', '18:00', '15:00'], correctIndex: 0,
      explanation: 'Dos horas después de las 14:00 son las 16:00.',
      meta: { subject: 'matematicas', topic: 'medidas', difficulty: 2 },
    },
    explanation: 'Dos horas después de las 14:00 son las 16:00.',
    meta: { subject: 'matematicas', topic: 'medidas', difficulty: 2 },
  },

  // ---- Lengua: single-select ----
  {
    id: 'len-ss-01', type: 'singleSelect',
    prompt: '¿Cuál es el plural de "flor"?',
    options: ['Flores', 'Flors', 'Floras', 'Florees'], correctIndex: 0,
    explanation: 'El plural de "flor" es "flores".',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 1 },
  },
  {
    id: 'len-ss-02', type: 'singleSelect',
    prompt: '¿Cuál de estas palabras es un adjetivo?',
    options: ['Correr', 'Rápido', 'Mesa', 'Ayer'], correctIndex: 1,
    explanation: '"Rápido" describe cómo es algo, por eso es un adjetivo.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 1 },
  },
  {
    id: 'len-ss-03', type: 'singleSelect',
    prompt: '¿Cómo se escribe correctamente?',
    options: ['Haber', 'Aber', 'Aver', 'Haver'], correctIndex: 0,
    explanation: 'Se escribe "haber", con hache.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 1 },
  },
  {
    id: 'len-ss-04', type: 'singleSelect',
    prompt: '¿Cuál es el sinónimo de "contento"?',
    options: ['Feliz', 'Triste', 'Enfadado', 'Cansado'], correctIndex: 0,
    explanation: '"Feliz" significa casi lo mismo que "contento".',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
  },
  {
    id: 'len-ss-05', type: 'singleSelect',
    prompt: '¿Cuál es el antónimo de "grande"?',
    options: ['Enorme', 'Pequeño', 'Alto', 'Ancho'], correctIndex: 1,
    explanation: '"Pequeño" es lo contrario de "grande".',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
  },
  {
    id: 'len-ss-06', type: 'singleSelect',
    prompt: 'En la frase "El perro corre rápido", ¿cuál es el verbo?',
    options: ['Perro', 'Corre', 'Rápido', 'El'], correctIndex: 1,
    explanation: '"Corre" es la acción que hace el perro, por eso es el verbo.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },
  {
    id: 'len-ss-07', type: 'singleSelect',
    prompt: '¿Qué signo de puntuación se usa al final de una pregunta?',
    options: ['El punto', 'La coma', 'La interrogación', 'La exclamación'], correctIndex: 2,
    explanation: 'Las preguntas terminan con el signo de interrogación de cierre: ?',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 1 },
  },
  {
    id: 'len-ss-08', type: 'singleSelect',
    prompt: '¿Cuál de estas palabras está en plural?',
    options: ['Ventana', 'Ventanas', 'Ventanita', 'Ventanal'], correctIndex: 1,
    explanation: '"Ventanas" nombra más de una ventana.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 1 },
  },
  {
    id: 'len-ss-09', type: 'singleSelect',
    prompt: 'Completa: "Los niños ___ al parque todos los días."',
    options: ['Va', 'Van', 'Vamos', 'Voy'], correctIndex: 1,
    explanation: 'Como hablamos de "los niños" (varios), el verbo va en plural: "van".',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },
  {
    id: 'len-ss-10', type: 'singleSelect',
    prompt: '¿Qué palabra se escribe con "b"?',
    options: ['Viaje', 'Vaca', 'Burro', 'Vaso'], correctIndex: 2,
    explanation: '"Burro" se escribe con b. Las otras llevan v.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 2 },
  },

  // ---- Lengua: multi-select ----
  {
    id: 'len-ms-01', type: 'multiSelect',
    prompt: '¿Cuáles de estas palabras son adjetivos?',
    options: ['Veloz', 'Mesa', 'Alegre', 'Comer', 'Enorme'], correctIndices: [0, 2, 4],
    explanation: '"Veloz", "alegre" y "enorme" describen cómo es algo o alguien.',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },
  {
    id: 'len-ms-02', type: 'multiSelect',
    prompt: '¿Cuáles de estas palabras llevan tilde?',
    options: ['Árbol', 'Camión', 'Mesa', 'Jardín', 'Silla'], correctIndices: [0, 1, 3],
    explanation: '"Árbol", "camión" y "jardín" llevan tilde. "Mesa" y "silla" no.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 2 },
  },
  {
    id: 'len-ms-03', type: 'multiSelect',
    prompt: '¿Cuáles de estas letras son vocales?',
    options: ['A', 'M', 'E', 'T', 'U'], correctIndices: [0, 2, 4],
    explanation: 'Las vocales son a, e, i, o, u. De esta lista: a, e y u.',
    meta: { subject: 'lengua', topic: 'ortografia', difficulty: 1 },
  },
  {
    id: 'len-ms-04', type: 'multiSelect',
    prompt: '¿Cuáles de estas palabras significan casi lo mismo que "bonito"?',
    options: ['Feo', 'Precioso', 'Hermoso', 'Grande', 'Lindo'], correctIndices: [1, 2, 4],
    explanation: '"Precioso", "hermoso" y "lindo" son sinónimos de "bonito".',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 2 },
  },

  // ---- Lengua: typed ----
  {
    id: 'len-ty-01', type: 'typed',
    prompt: '¿Cuál es el plural de "pez"?',
    expectedConcept: 'peces', keywords: ['peces'],
    exampleAnswers: ['Peces', 'peces', 'Los peces'],
    fallbackMultipleChoice: {
      id: 'len-ty-01-mc', type: 'singleSelect',
      prompt: '¿Cuál es el plural de "pez"?',
      options: ['Peces', 'Pezes', 'Peses', 'Pez'], correctIndex: 0,
      explanation: 'El plural de "pez" es "peces".',
      meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
    },
    explanation: 'El plural de "pez" es "peces".',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },
  {
    id: 'len-ty-02', type: 'typed',
    prompt: '¿Cuál es el femenino de "actor"?',
    expectedConcept: 'actriz', keywords: ['actriz'],
    exampleAnswers: ['Actriz', 'actriz', 'La actriz'],
    fallbackMultipleChoice: {
      id: 'len-ty-02-mc', type: 'singleSelect',
      prompt: '¿Cuál es el femenino de "actor"?',
      options: ['Actora', 'Actriz', 'Actriza', 'Actore'], correctIndex: 1,
      explanation: 'El femenino de "actor" es "actriz".',
      meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
    },
    explanation: 'El femenino de "actor" es "actriz".',
    meta: { subject: 'lengua', topic: 'gramatica', difficulty: 2 },
  },
  {
    id: 'len-ty-03', type: 'typed',
    prompt: '¿Cuál es el diminutivo de "casa"?',
    expectedConcept: 'casita', keywords: ['casita'],
    exampleAnswers: ['Casita', 'casita', 'Una casita'],
    fallbackMultipleChoice: {
      id: 'len-ty-03-mc', type: 'singleSelect',
      prompt: '¿Cuál es el diminutivo de "casa"?',
      options: ['Casona', 'Casuela', 'Casita', 'Casilla'], correctIndex: 2,
      explanation: 'El diminutivo de "casa" es "casita".',
      meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
    },
    explanation: 'El diminutivo de "casa" es "casita".',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 1 },
  },
  {
    id: 'len-ty-04', type: 'typed',
    prompt: '¿Cómo se llama una palabra que significa casi lo mismo que otra?',
    expectedConcept: 'sinonimo', keywords: ['sinonimo', 'sinónimo'],
    exampleAnswers: ['Sinónimo', 'Un sinónimo', 'sinonimos'],
    fallbackMultipleChoice: {
      id: 'len-ty-04-mc', type: 'singleSelect',
      prompt: '¿Cómo se llama una palabra que significa casi lo mismo que otra?',
      options: ['Sinónimo', 'Antónimo', 'Homónimo', 'Prefijo'], correctIndex: 0,
      explanation: 'Una palabra que significa casi lo mismo que otra es un sinónimo.',
      meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 2 },
    },
    explanation: 'Una palabra que significa casi lo mismo que otra es un sinónimo.',
    meta: { subject: 'lengua', topic: 'vocabulario', difficulty: 2 },
  },
];
