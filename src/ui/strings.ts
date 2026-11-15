/**
 * Every child-facing string, in English and Spanish.
 *
 * The screen's language follows the language of the questions on it, so a
 * Spanish bank question never sits under an English button. Written for a 9 to
 * 14 year old: short, specific, and never the voice used for a six year old.
 */

import type { UiLanguage } from '../quiz/quizStore.js';

export interface Strings {
  pageTitle: string;
  gettingReady: string;
  somethingWrong: string;

  introTitle: string;
  /** "3 questions. Get them all." */
  introGoal: (total: number, passMark: number) => string;
  introNote: string;
  start: string;

  questionCounter: (index: number, total: number) => string;
  roundCounter: (round: number, maxRounds: number) => string;
  generalQuestions: string;
  generalQuestionsNote: string;

  multiHint: string;
  typedPlaceholder: string;
  typedLabel: string;
  check: string;
  checking: string;

  discard: string;
  discardsLeft: (left: number) => string;
  noDiscardsLeft: string;
  swapped: string;
  tryDifferentWay: string;

  correctHeadlines: string[];
  incorrectHeadlines: string[];
  xp: (amount: number) => string;
  next: string;

  passedPerfect: string;
  passed: string;
  score: (correct: number, total: number) => string;
  answersRow: string;
  perfectRow: string;
  totalXp: (total: number) => string;
  streak: (count: number) => string;
  meterLabel: string;
  meterProgress: (filled: number, steps: number) => string;
  meterFullCta: string;
  backToVideos: string;

  missedTitle: string;
  missedBody: (questions: number) => string;
  missedRound: (round: number, maxRounds: number) => string;
  go: string;

  remediationPassedTitle: string;
  remediationPassedBody: string;
  remediationEndedTitle: string;
  remediationEndedBody: string;

  badgeTitle: string;
  badgeBody: (name: string) => string;
  allBadgesTitle: string;
  allBadgesBody: string;
  collection: (owned: number, total: number) => string;
  lockedBadge: string;
}

const en: Strings = {
  pageTitle: 'Challenge time',
  gettingReady: 'Getting your challenge ready...',
  somethingWrong: "Something went wrong. We're sending you back to your videos.",

  introTitle: 'Challenge time',
  introGoal: (total, passMark) =>
    total === 1
      ? '1 question. Get it right.'
      : passMark === total
        ? `${total} questions. Get them all.`
        : `${total} questions. Get ${passMark} to pass.`,
  introNote: "They're about the video you just watched.",
  start: 'Start',

  questionCounter: (index, total) => `Question ${index} of ${total}`,
  roundCounter: (round, maxRounds) => `Go-over round ${round} of ${maxRounds}`,
  generalQuestions: 'General questions',
  generalQuestionsNote: "We couldn't read this video, so these are general questions.",

  multiHint: 'More than one answer is right. Pick every one that fits.',
  typedPlaceholder: 'Type your answer',
  typedLabel: 'Your answer, in a few words',
  check: 'Check',
  checking: 'Checking...',

  discard: 'This question makes no sense',
  discardsLeft: (left) => (left === 1 ? '1 swap left' : `${left} swaps left`),
  noDiscardsLeft: 'No swaps left for this challenge',
  swapped: 'Fair enough. Here is a different one.',
  tryDifferentWay: "Let's try that one a different way.",

  correctHeadlines: ['Got it.', 'Spot on.', 'Exactly right.', 'You were paying attention.', 'Correct.'],
  incorrectHeadlines: ['Not quite.', 'Close, not this time.', 'Not this one.'],
  xp: (amount) => `+${amount} XP`,
  next: 'Next',

  passedPerfect: 'Perfect challenge.',
  passed: 'Challenge cleared.',
  score: (correct, total) => `${correct} of ${total} right`,
  answersRow: 'Right answers',
  perfectRow: 'Perfect bonus',
  totalXp: (total) => `${total} XP in total`,
  streak: (count) => `${count} challenges in a row`,
  meterLabel: 'Mystery meter',
  meterProgress: (filled, steps) => `${filled} of ${steps}`,
  meterFullCta: 'Open it',
  backToVideos: 'Back to videos',

  missedTitle: "Let's go over that bit again.",
  missedBody: (questions) => `${questions} quick questions on the same video, then you're back to it.`,
  missedRound: (round, maxRounds) => `Round ${round} of ${maxRounds}`,
  go: "Let's go",

  remediationPassedTitle: "That's it, you've got it now.",
  remediationPassedBody: 'Going back over it worked. Your videos are ready.',
  remediationEndedTitle: "That's enough for this one.",
  remediationEndedBody: 'Some videos are just hard to remember. Your videos are ready, and the next challenge is a fresh start.',

  badgeTitle: 'The meter is full.',
  badgeBody: (name) => `New badge for your collection: ${name}.`,
  allBadgesTitle: 'The meter is full again.',
  allBadgesBody: 'You already own every badge. That takes a lot of full meters.',
  collection: (owned, total) => `Your badges, ${owned} of ${total}`,
  lockedBadge: 'Not found yet',
};

const es: Strings = {
  pageTitle: 'Hora del reto',
  gettingReady: 'Preparando tu reto...',
  somethingWrong: 'Algo ha fallado. Te llevamos de vuelta a tus vídeos.',

  introTitle: 'Hora del reto',
  introGoal: (total, passMark) =>
    total === 1
      ? '1 pregunta. Aciértala.'
      : passMark === total
        ? `${total} preguntas. Acierta todas.`
        : `${total} preguntas. Acierta ${passMark} para pasar.`,
  introNote: 'Son sobre el vídeo que acabas de ver.',
  start: 'Empezar',

  questionCounter: (index, total) => `Pregunta ${index} de ${total}`,
  roundCounter: (round, maxRounds) => `Ronda de repaso ${round} de ${maxRounds}`,
  generalQuestions: 'Preguntas generales',
  generalQuestionsNote: 'No hemos podido leer este vídeo, así que estas preguntas son generales.',

  multiHint: 'Hay más de una respuesta correcta. Marca todas las que encajen.',
  typedPlaceholder: 'Escribe tu respuesta',
  typedLabel: 'Tu respuesta, en pocas palabras',
  check: 'Comprobar',
  checking: 'Comprobando...',

  discard: 'Esta pregunta no tiene sentido',
  discardsLeft: (left) => (left === 1 ? 'Te queda 1 cambio' : `Te quedan ${left} cambios`),
  noDiscardsLeft: 'No quedan cambios en este reto',
  swapped: 'Vale. Aquí tienes otra.',
  tryDifferentWay: 'Vamos a probar esa de otra forma.',

  correctHeadlines: ['Eso es.', 'Correcto.', 'Justo eso.', 'Estabas prestando atención.', 'Muy bien visto.'],
  incorrectHeadlines: ['No del todo.', 'Casi, esta vez no.', 'Esta no.'],
  xp: (amount) => `+${amount} XP`,
  next: 'Siguiente',

  passedPerfect: 'Reto perfecto.',
  passed: 'Reto superado.',
  score: (correct, total) => `${correct} de ${total} correctas`,
  answersRow: 'Respuestas correctas',
  perfectRow: 'Bonus por reto perfecto',
  totalXp: (total) => `${total} XP en total`,
  streak: (count) => `${count} retos seguidos`,
  meterLabel: 'Medidor misterioso',
  meterProgress: (filled, steps) => `${filled} de ${steps}`,
  meterFullCta: 'Ábrelo',
  backToVideos: 'Volver a los vídeos',

  missedTitle: 'Vamos a repasar esa parte.',
  missedBody: (questions) => `${questions} preguntas rápidas sobre el mismo vídeo y vuelves a él.`,
  missedRound: (round, maxRounds) => `Ronda ${round} de ${maxRounds}`,
  go: 'Vamos',

  remediationPassedTitle: 'Eso es, ya lo tienes.',
  remediationPassedBody: 'Repasarlo ha funcionado. Tus vídeos están listos.',
  remediationEndedTitle: 'Ya está bien con este.',
  remediationEndedBody: 'Hay vídeos difíciles de recordar. Tus vídeos están listos y el próximo reto empieza de cero.',

  badgeTitle: 'El medidor está lleno.',
  badgeBody: (name) => `Nueva insignia para tu colección: ${name}.`,
  allBadgesTitle: 'El medidor se ha llenado otra vez.',
  allBadgesBody: 'Ya tienes todas las insignias. Para eso hacen falta muchos medidores llenos.',
  collection: (owned, total) => `Tus insignias, ${owned} de ${total}`,
  lockedBadge: 'Aún sin descubrir',
};

const STRINGS: Record<UiLanguage, Strings> = { en, es };

export function stringsFor(language: UiLanguage): Strings {
  return STRINGS[language] ?? en;
}

/**
 * Before any question has arrived there is no quiz language to follow, so the
 * first paint uses the browser's own language.
 */
export function browserLanguage(): UiLanguage {
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}
