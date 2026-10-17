/**
 * AiSteth Academy - Answer Evaluator
 * Pure, deterministic evaluation functions for all 5 question types.
 */

import {
  Question,
  UserAnswerPayload,
  AnswerEvaluationResult,
  MCQQuestion,
  TrueFalseQuestion,
  ImageTapQuestion,
  StepOrderQuestion,
  AudioDiscriminationQuestion
} from '../models/question.types';
import { SESSION_CONFIG } from '../models/session.types';

export class AnswerEvaluator {
  /**
   * Validates whether a given payload constitutes a valid, non-empty answer for a question.
   */
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

  /**
   * Evaluates any question against a user answer payload.
   * Defensively returns UNANSWERED status if payload is invalid, null, or empty.
   */
  static evaluate(
    question: Question,
    payload: UserAnswerPayload | null | undefined
  ): AnswerEvaluationResult {
    if (!question || !payload || !AnswerEvaluator.isValidAnswer(question, payload)) {
      return AnswerEvaluator.createUnansweredResult(question, payload ?? null);
    }

    switch (question.type) {
      case 'MCQ':
        return AnswerEvaluator.evaluateMCQ(question, payload as Extract<UserAnswerPayload, { type: 'MCQ' }>);
      case 'TRUE_FALSE':
        return AnswerEvaluator.evaluateTrueFalse(question, payload as Extract<UserAnswerPayload, { type: 'TRUE_FALSE' }>);
      case 'IMAGE_TAP':
        return AnswerEvaluator.evaluateImageTap(question, payload as Extract<UserAnswerPayload, { type: 'IMAGE_TAP' }>);
      case 'STEP_ORDER':
        return AnswerEvaluator.evaluateStepOrder(question, payload as Extract<UserAnswerPayload, { type: 'STEP_ORDER' }>);
      case 'AUDIO_DISCRIMINATION':
        return AnswerEvaluator.evaluateAudioDiscrimination(question, payload as Extract<UserAnswerPayload, { type: 'AUDIO_DISCRIMINATION' }>);
      default:
        return AnswerEvaluator.createUnansweredResult(question, payload);
    }
  }

  private static createUnansweredResult(
    question: Question | null | undefined,
    payload: UserAnswerPayload | null
  ): AnswerEvaluationResult {
    return {
      status: 'UNANSWERED',
      is_correct: false,
      user_payload: payload,
      correct_solution_display: 'No answer submitted',
      explanation: question?.explanation || '',
      learning_objective: question?.learning_objective || '',
      category: question?.category || 'DEVICE_HANDLING',
      question_id: question?.question_id || '',
      awarded_xp: 0,
    };
  }

  private static evaluateMCQ(
    q: MCQQuestion,
    payload: Extract<UserAnswerPayload, { type: 'MCQ' }>
  ): AnswerEvaluationResult {
    const isCorrect = payload.selected_option === q.correct_answer;
    const optionMap: Record<string, string> = {
      option_a: `A. ${q.option_a}`,
      option_b: `B. ${q.option_b}`,
      option_c: `C. ${q.option_c}`,
      option_d: `D. ${q.option_d}`,
    };

    return {
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      is_correct: isCorrect,
      user_payload: payload,
      correct_solution_display: (q.correct_answer && optionMap[q.correct_answer]) || q.correct_answer || '',
      explanation: q.explanation,
      learning_objective: q.learning_objective,
      category: q.category,
      question_id: q.question_id,
      awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.MCQ_CORRECT : 0
    };
  }

  private static evaluateTrueFalse(
    q: TrueFalseQuestion,
    payload: Extract<UserAnswerPayload, { type: 'TRUE_FALSE' }>
  ): AnswerEvaluationResult {
    const isCorrect = payload.selected_boolean === q.correct_answer;

    return {
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      is_correct: isCorrect,
      user_payload: payload,
      correct_solution_display: q.correct_answer ? 'TRUE (Correct)' : 'FALSE (Incorrect Statement)',
      explanation: q.explanation,
      learning_objective: q.learning_objective,
      category: q.category,
      question_id: q.question_id,
      awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.TRUE_FALSE_CORRECT : 0
    };
  }

  private static evaluateImageTap(
    q: ImageTapQuestion,
    payload: Extract<UserAnswerPayload, { type: 'IMAGE_TAP' }>
  ): AnswerEvaluationResult {
    const { x_percent, y_percent } = payload.tap_coordinate;
    const { x_min_percent, y_min_percent, x_max_percent, y_max_percent, label } = q.target_zone;
    const tolerance = q.tolerance_radius_percent ?? 0;

    // Check if inside target zone bounding box (expanded by optional tolerance)
    const inX = x_percent >= x_min_percent - tolerance && x_percent <= x_max_percent + tolerance;
    const inY = y_percent >= y_min_percent - tolerance && y_percent <= y_max_percent + tolerance;
    const isCorrect = inX && inY;

    return {
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      is_correct: isCorrect,
      user_payload: payload,
      correct_solution_display: label || `Target Region (${x_min_percent}% - ${x_max_percent}%)`,
      explanation: q.explanation,
      learning_objective: q.learning_objective,
      category: q.category,
      question_id: q.question_id,
      awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.PRACTICAL_CORRECT : 0
    };
  }

  private static evaluateStepOrder(
    q: StepOrderQuestion,
    payload: Extract<UserAnswerPayload, { type: 'STEP_ORDER' }>
  ): AnswerEvaluationResult {
    const userOrder = payload.ordered_step_ids;
    const correctOrder = q.correct_step_order;

    let isCorrect = userOrder.length === correctOrder.length;
    if (isCorrect) {
      for (let i = 0; i < correctOrder.length; i++) {
        if (userOrder[i] !== correctOrder[i]) {
          isCorrect = false;
          break;
        }
      }
    }

    // Build readable sequential display
    const stepTextMap = new Map(q.initial_steps.map((s) => [s.id, s.text]));
    const formattedSteps = correctOrder
      .map((id, index) => `${index + 1}. ${stepTextMap.get(id) || id}`)
      .join('\n');

    return {
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      is_correct: isCorrect,
      user_payload: payload,
      correct_solution_display: formattedSteps,
      explanation: q.explanation,
      learning_objective: q.learning_objective,
      category: q.category,
      question_id: q.question_id,
      awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.PRACTICAL_CORRECT : 0
    };
  }

  private static evaluateAudioDiscrimination(
    q: AudioDiscriminationQuestion,
    payload: Extract<UserAnswerPayload, { type: 'AUDIO_DISCRIMINATION' }>
  ): AnswerEvaluationResult {
    const isCorrect = payload.selected_audio === q.correct_audio;
    const label = q.correct_audio === 'audio_a' ? (q.label_a || 'Recording 1') : (q.label_b || 'Recording 2');

    return {
      status: isCorrect ? 'CORRECT' : 'INCORRECT',
      is_correct: isCorrect,
      user_payload: payload,
      correct_solution_display: `${label} — ${q.clinical_finding}`,
      explanation: q.explanation,
      learning_objective: q.learning_objective,
      category: q.category,
      question_id: q.question_id,
      awarded_xp: isCorrect ? SESSION_CONFIG.XP_REWARDS.PRACTICAL_CORRECT : 0
    };
  }
}
