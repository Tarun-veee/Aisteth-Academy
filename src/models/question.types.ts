/**
 * AiSteth Academy - Question Domain Models
 * Strict TypeScript Discriminated Unions for all supported question types.
 */

export type QuestionType =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'IMAGE_TAP'
  | 'STEP_ORDER'
  | 'AUDIO_DISCRIMINATION';

export type DifficultyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type QuestionCategory =
  | 'DEVICE_HANDLING'
  | 'HEART_RECORDING'
  | 'QUALITY_ASSESSMENT'
  | 'OPERATING_PROCEDURE'
  | 'ANATOMICAL_PLACEMENT';

export const QUESTION_CATEGORIES: Record<QuestionCategory, { label: string; description: string }> = {
  DEVICE_HANDLING: {
    label: 'Device Handling',
    description: 'Physical operation, hygiene, charging, and preparation of the AiSteth digital stethoscope.'
  },
  HEART_RECORDING: {
    label: 'Heart Recording',
    description: 'Recording technique, duration, patient posture, and stability.'
  },
  QUALITY_ASSESSMENT: {
    label: 'Recording Quality Assessment',
    description: 'Evaluating acoustic signal clarity, identifying noise/friction artifacts.'
  },
  OPERATING_PROCEDURE: {
    label: 'Operating Procedure',
    description: 'Standard operating workflows and clinical steps from preparation to recording completion.'
  },
  ANATOMICAL_PLACEMENT: {
    label: 'Anatomical Placement',
    description: 'Locating specific cardiac auscultation landmarks on the thorax.'
  }
};

export interface BaseQuestion {
  question_id: string;
  questionId?: string;
  category: QuestionCategory;
  type: QuestionType;
  difficulty: DifficultyLevel;
  question: string;
  explanation: string;
  learning_objective: string;
  tags: string[];
  clinician_validated: boolean;
  source: 'DEMO' | 'CLINICAL' | 'MEDGEMMA';
  version: string;
  question_type?: 'Primary' | 'Follow-Up';
  follow_up_for?: string | null;
  Question_Type?: 'Primary' | 'Follow-Up';
  Follow_Up_For?: string | null;
  topic?: string;
  Topic?: string;
  difficulty_rank?: number;
  Difficulty_Rank?: number;
}


// 1. MCQ Schema
export interface MCQQuestion extends BaseQuestion {
  type: 'MCQ';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  options?: {
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
  };
  correct_answer?: 'option_a' | 'option_b' | 'option_c' | 'option_d';
}

// 2. True / False Schema
export interface TrueFalseQuestion extends BaseQuestion {
  type: 'TRUE_FALSE';
  correct_answer: boolean;
}

// 3. Image Tap Schema
export interface ImageTapTargetZone {
  x_min_percent: number; // 0.0 - 100.0%
  y_min_percent: number;
  x_max_percent: number;
  y_max_percent: number;
  label?: string;
}

export interface ImageTapQuestion extends BaseQuestion {
  type: 'IMAGE_TAP';
  image_asset: string;
  target_zone: ImageTapTargetZone;
  tolerance_radius_percent?: number;
}

// 4. Step Order Schema
export interface StepItem {
  id: string;
  text: string;
}

export interface StepOrderQuestion extends BaseQuestion {
  type: 'STEP_ORDER';
  initial_steps: StepItem[];
  correct_step_order: string[]; // Array of step IDs in exact correct sequence
}

// 5. Audio Discrimination Schema
export interface AudioDiscriminationQuestion extends BaseQuestion {
  type: 'AUDIO_DISCRIMINATION';
  audio_asset_a: string;
  audio_asset_b: string;
  label_a?: string;
  label_b?: string;
  correct_audio: 'audio_a' | 'audio_b';
  clinical_finding: string;
}

// Discriminated Union
export type Question =
  | MCQQuestion
  | TrueFalseQuestion
  | ImageTapQuestion
  | StepOrderQuestion
  | AudioDiscriminationQuestion;

// Answer Submission Payloads
export type UserAnswerPayload =
  | { type: 'MCQ'; selected_option: 'option_a' | 'option_b' | 'option_c' | 'option_d' }
  | { type: 'TRUE_FALSE'; selected_boolean: boolean }
  | { type: 'IMAGE_TAP'; tap_coordinate: { x_percent: number; y_percent: number } }
  | { type: 'STEP_ORDER'; ordered_step_ids: string[] }
  | { type: 'AUDIO_DISCRIMINATION'; selected_audio: 'audio_a' | 'audio_b' };

export type AnswerStatus = 'UNANSWERED' | 'CORRECT' | 'INCORRECT';

// Evaluated Answer Result
export interface AnswerEvaluationResult {
  status: AnswerStatus;
  is_correct: boolean;
  user_payload: UserAnswerPayload | null;
  correct_solution_display: string;
  explanation: string;
  learning_objective: string;
  category: QuestionCategory;
  question_id: string;
  awarded_xp: number;
}

/**
 * Canonical Question Normalizer.
 * Maps API DTOs (e.g. SafeQuestionDTO with questionId, nested options)
 * to client Question domain models while strictly preserving unsupported
 * or unknown question types so genuinely malformed data fails closed safely.
 */
export function normalizeQuestion(raw: any): Question {
  if (!raw || typeof raw !== 'object') return raw;

  const qId = raw.question_id || raw.questionId || '';
  // Preserve raw.type if defined (including unknown types for fail-closed validation).
  // If raw.type is absent, detect MCQ only if option fields are present.
  const hasOptions = Boolean(raw.options?.option_a || raw.option_a);
  const type: QuestionType | undefined = raw.type ?? (hasOptions ? 'MCQ' : undefined);

  const optionsObj = raw.options || {};
  const option_a = raw.option_a || optionsObj.option_a || '';
  const option_b = raw.option_b || optionsObj.option_b || '';
  const option_c = raw.option_c || optionsObj.option_c || '';
  const option_d = raw.option_d || optionsObj.option_d || '';
  const question_type = raw.question_type || raw.questionType || (qId.endsWith('-PR') ? 'Follow-Up' : 'Primary');
  const follow_up_for = raw.follow_up_for !== undefined ? raw.follow_up_for : (raw.followUpFor !== undefined ? raw.followUpFor : null);

  const action = raw.action || raw.Action || '';
  const learning_objective = raw.learning_objective || raw.learningObjective || action;

  return {
    ...raw,
    question_id: qId,
    questionId: qId,
    type: type as QuestionType,
    category: raw.category || 'HEART_RECORDING',
    difficulty: raw.difficulty || 'BEGINNER',
    question: raw.question || '',
    question_type,
    Question_Type: question_type,
    follow_up_for,
    Follow_Up_For: follow_up_for,
    learning_objective,
    action: action || undefined,
    Action: action || undefined,
    option_a,
    option_b,
    option_c,
    option_d,
    options: {
      option_a,
      option_b,
      option_c,
      option_d,
    },
  } as Question;
}

