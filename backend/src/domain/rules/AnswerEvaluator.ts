import {
  Question,
  UserAnswerPayload,
  AnswerEvaluationResult,
  MCQQuestion,
  TrueFalseQuestion,
  ImageTapQuestion,
  StepOrderQuestion,
  AudioDiscriminationQuestion
} from '../models/question.model.js';

export const SESSION_CONFIG = {
  DEFAULT_SESSION_LENGTH: 10,
  XP_REWARDS: {
    MCQ_CORRECT: 5,
    TRUE_FALSE_CORRECT: 5,
    PRACTICAL_CORRECT: 10,
    SESSION_COMPLETION_BONUS: 10,
  }
} as const;

export class AnswerEvaluator {
  static isValidAnswer(
    question: Question | null | undefined,
    payload: UserAnswerPayload | null | undefined
  ): boolean {
    if (!question || !payload) return false;

    switch (question.type) {
      case 'MCQ': {
        if (payload.type !== 'MCQ') return false;
        const validOptions = ['option_a', 'option_b', 'option_c', 'option_d'];
        return typeof payload.selected_option === 'string' && validOptions.includes(payload.selected_option);
      }
      case 'TRUE_FALSE': {
        if (payload.type !== 'TRUE_FALSE') return false;
        return typeof payload.selected_boolean === 'boolean';
      }
      case 'IMAGE_TAP': {
        if (payload.type !== 'IMAGE_TAP' || !payload.tap_coordinate) return false;
        const { x_percent, y_percent } = payload.tap_coordinate;
        return (
          typeof x_percent === 'number' &&
          typeof y_percent === 'number' &&
          !isNaN(x_percent) &&
          !isNaN(y_percent)
        );
      }
      case 'STEP_ORDER': {
        if (payload.type !== 'STEP_ORDER') return false;
        const stepQ = question as StepOrderQuestion;
        return (
          Array.isArray(payload.ordered_step_ids) &&
          payload.ordered_step_ids.length > 0 &&
          payload.ordered_step_ids.length === stepQ.correct_step_order?.length
        );
      }
      case 'AUDIO_DISCRIMINATION': {
        if (payload.type !== 'AUDIO_DISCRIMINATION') return false;
        return payload.selected_audio === 'audio_a' || payload.selected_audio === 'audio_b';
      }
      default:
        return false;
    }
  }

  static evaluate(
    question: Question,
    payload: UserAnswerPayload
  ): AnswerEvaluationResult {
    switch (question.type) {
      case 'MCQ': {
        const mcq = question as MCQQuestion;
        const isCorrect = payload.selected_option === mcq.correct_answer;
        const qAny = question as any;
        const action = qAny.action ?? qAny.Action;
        return {
          is_correct: isCorrect,
          awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.MCQ_CORRECT : 0,
          feedback_message: isCorrect ? 'Correct diagnosis!' : 'Incorrect option selected.',
          explanation: mcq.explanation,
          ...(action !== undefined ? { action } : {}),
          ...(mcq.correct_answer !== undefined ? { correct_answer: mcq.correct_answer } : {})
        };
      }
      case 'TRUE_FALSE': {
        const tf = question as TrueFalseQuestion;
        const isCorrect = payload.selected_boolean === tf.correct_answer;
        const qAny = question as any;
        const action = qAny.action ?? qAny.Action;
        return {
          is_correct: isCorrect,
          awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.TRUE_FALSE_CORRECT : 0,
          feedback_message: isCorrect ? 'Correct evaluation!' : 'Incorrect evaluation.',
          explanation: tf.explanation,
          ...(action !== undefined ? { action } : {}),
          ...(tf.correct_answer !== undefined ? { correct_answer: String(tf.correct_answer) } : {})
        };
      }
      case 'IMAGE_TAP': {
        const img = question as ImageTapQuestion;
        const { x_percent, y_percent } = payload.tap_coordinate!;
        const { x_percent: targetX, y_percent: targetY, radius_percent } = img.target_zone;
        const distance = Math.sqrt(Math.pow(x_percent - targetX, 2) + Math.pow(y_percent - targetY, 2));
        const isCorrect = distance <= radius_percent;
        const qAny = question as any;
        const action = qAny.action ?? qAny.Action;
        return {
          is_correct: isCorrect,
          awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.PRACTICAL_CORRECT : 0,
          feedback_message: isCorrect ? 'Target landmark accurately identified!' : 'Placement outside landmark target zone.',
          explanation: img.explanation,
          ...(action !== undefined ? { action } : {})
        };
      }
      case 'STEP_ORDER': {
        const step = question as StepOrderQuestion;
        const isCorrect = JSON.stringify(payload.ordered_step_ids) === JSON.stringify(step.correct_step_order);
        const qAny = question as any;
        const action = qAny.action ?? qAny.Action;
        return {
          is_correct: isCorrect,
          awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.PRACTICAL_CORRECT : 0,
          feedback_message: isCorrect ? 'Procedure sequence ordered correctly!' : 'Incorrect step order sequence.',
          explanation: step.explanation,
          ...(action !== undefined ? { action } : {})
        };
      }
      case 'AUDIO_DISCRIMINATION': {
        const audio = question as AudioDiscriminationQuestion;
        const isCorrect = payload.selected_audio === audio.correct_audio;
        const qAny = question as any;
        const action = qAny.action ?? qAny.Action;
        return {
          is_correct: isCorrect,
          awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.PRACTICAL_CORRECT : 0,
          feedback_message: isCorrect ? 'Cardiac sound accurately identified!' : 'Incorrect recording selected.',
          explanation: audio.explanation,
          ...(action !== undefined ? { action } : {}),
          ...(audio.correct_audio !== undefined ? { correct_answer: audio.correct_audio } : {})
        };
      }
      default:
        return {
          is_correct: false,
          awarded_xp: 0,
          feedback_message: 'Unknown question format.',
          explanation: ''
        };
    }
  }
}
