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
}

// 1. MCQ Schema
export interface MCQQuestion extends BaseQuestion {
  type: 'MCQ';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'option_a' | 'option_b' | 'option_c' | 'option_d';
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
