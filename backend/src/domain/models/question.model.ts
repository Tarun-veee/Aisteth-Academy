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
  question_type?: 'Primary' | 'Follow-Up';
  follow_up_for?: string | null;
  Question_Type?: 'Primary' | 'Follow-Up';
  Follow_Up_For?: string | null;
  topic?: string;
  Topic?: string;
  difficulty_rank?: number;
  Difficulty_Rank?: number;
  audience?: string;
  Audience?: string;
  action?: string;
  Action?: string;
  medGemma_tag?: string;
  MedGemma_Tag?: string;
}


export interface MCQQuestion extends BaseQuestion {
  type: 'MCQ';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'option_a' | 'option_b' | 'option_c' | 'option_d';
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'TRUE_FALSE';
  correct_answer: boolean;
}

export interface ImageTapQuestion extends BaseQuestion {
  type: 'IMAGE_TAP';
  image_url: string;
  target_zone: {
    x_percent: number;
    y_percent: number;
    radius_percent: number;
  };
}

export interface StepOrderQuestion extends BaseQuestion {
  type: 'STEP_ORDER';
  steps: {
    id: string;
    text: string;
  }[];
  correct_step_order: string[];
}

export interface AudioDiscriminationQuestion extends BaseQuestion {
  type: 'AUDIO_DISCRIMINATION';
  audio_url_a: string;
  audio_url_b: string;
  correct_audio: 'audio_a' | 'audio_b';
}

export type Question =
  | MCQQuestion
  | TrueFalseQuestion
  | ImageTapQuestion
  | StepOrderQuestion
  | AudioDiscriminationQuestion;

export interface UserAnswerPayload {
  question_id: string;
  type: QuestionType;
  selected_option?: 'option_a' | 'option_b' | 'option_c' | 'option_d';
  selected_boolean?: boolean;
  tap_coordinate?: {
    x_percent: number;
    y_percent: number;
  };
  ordered_step_ids?: string[];
  selected_audio?: 'audio_a' | 'audio_b';
}

export interface AnswerEvaluationResult {
  is_correct: boolean;
  awarded_xp: number;
  feedback_message: string;
  explanation: string;
  action?: string;
  correct_answer?: string;
}

export interface SafeQuestionDTO {
  questionId: string;
  type: QuestionType;
  topic: string;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  question: string;
  options: {
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
  };
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  question_id?: string;
  questionType: 'Primary' | 'Follow-Up';
  followUpFor: string | null;
  medGemmaTag?: string;
}

