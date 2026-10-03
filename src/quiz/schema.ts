/**
 * The question and quiz data model.
 *
 * Shared by three sources that all have to produce the same shape: the local
 * fallback bank (this phase), the LLM generator (next phase), and tests. None
 * of them are trusted to get it right by construction, which is what
 * validate.ts is for.
 */

export type QuestionType = 'singleSelect' | 'typed' | 'multiSelect';

interface QuestionMeta {
  /** Set on fallback-bank questions. Absent on video-derived ones. */
  subject?: 'matematicas' | 'lengua';
  topic?: string;
  /** 1 easiest, 3 hardest. Used to pick remediation questions down a level. */
  difficulty?: 1 | 2 | 3;
}

interface BaseQuestion {
  id: string;
  prompt: string;
  /** Shown after answering, right or wrong. Never shaming. */
  explanation: string;
  meta?: QuestionMeta;
}

export interface SingleSelectQuestion extends BaseQuestion {
  type: 'singleSelect';
  options: string[];
  correctIndex: number;
}

export interface MultiSelectQuestion extends BaseQuestion {
  type: 'multiSelect';
  options: string[];
  /** 2 or 3 of these. Selecting every option must not count as correct. */
  correctIndices: number[];
}

export interface TypedQuestion extends BaseQuestion {
  type: 'typed';
  /** What a correct answer actually needs to say, for the grading ladder. */
  expectedConcept: string;
  keywords: string[];
  /** At least three, so local matching has something to compare against. */
  exampleAnswers: string[];
  /**
   * An equivalent single-select question. Used when grading cannot reach a
   * confident verdict and nothing should keep her waiting on a network call.
   */
  fallbackMultipleChoice: SingleSelectQuestion;
}

export type Question = SingleSelectQuestion | MultiSelectQuestion | TypedQuestion;

export type QuizSource = 'transcript' | 'metadata' | 'fallback';

export interface Quiz {
  id: string;
  videoId: string | null;
  source: QuizSource;
  /** The questions actually presented, in order. */
  questions: Question[];
  /** Reserve questions for the "this doesn't make sense" button. */
  spares: Question[];
  /** Generated up front so remediation survives losing the network. */
  remediationPool: Question[];
  createdAt: number;
}

export type AnswerResponse =
  | { type: 'singleSelect'; selectedIndex: number }
  | { type: 'multiSelect'; selectedIndices: number[] }
  | { type: 'typed'; text: string };
