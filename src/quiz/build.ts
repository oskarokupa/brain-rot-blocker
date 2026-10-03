/**
 * Assembles a full Quiz from the local fallback bank.
 *
 * This is the only source this phase has; the LLM path (transcript and
 * metadata derived quizzes) arrives in phase 4 behind the same Quiz shape, so
 * nothing downstream of this changes when it does.
 *
 * Every quiz leaving here has already passed validate.ts. The bank is hand
 * authored, so a failure here would mean a bug in the bank data itself, not
 * something to recover from at runtime by trying again.
 */

import { questionCountForDuration } from '../config.js';
import { selectFallbackQuiz, selectRemediationPool } from '../fallback/select.js';
import type { RecentIds } from './history.js';
import type { Quiz } from './schema.js';
import { validateQuizQuestions } from './validate.js';

function makeId(): string {
  return `quiz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface BuildFallbackQuizOptions {
  videoId: string | null;
  durationSeconds: number | null;
  recentQuestionIds: RecentIds;
}

export function buildFallbackQuiz(options: BuildFallbackQuizOptions): Quiz {
  const questionCount = questionCountForDuration(options.durationSeconds ?? Infinity);
  const { questions, spares } = selectFallbackQuiz(questionCount, options.recentQuestionIds);

  const result = validateQuizQuestions(questions, questionCount);
  if (!result.ok) {
    // The bank is static and hand-authored. Reaching this means a bank entry
    // itself is malformed, which is a bug to fix in the data, not a condition
    // to degrade from at runtime.
    throw new Error(`fallback bank produced an invalid quiz: ${result.problems.join('; ')}`);
  }

  const usedIds = new Set([...questions, ...spares].map((q) => q.id));
  const remediationPool = selectRemediationPool(usedIds, options.recentQuestionIds);

  return {
    id: makeId(),
    videoId: options.videoId,
    source: 'fallback',
    questions,
    spares,
    remediationPool,
    createdAt: Date.now(),
  };
}
