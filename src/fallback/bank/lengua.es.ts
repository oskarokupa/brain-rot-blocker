/**
 * Lengua castellana questions for the offline fallback bank. See ../bank.es.ts.
 */

import type { Question } from '../../quiz/schema.js';

export const LENGUA_ES: Question[] = [
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
