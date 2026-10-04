import { describe, it, expect } from 'vitest';
import { AnswerEvaluator } from '../src/services/AnswerEvaluator';
import {
  MCQQuestion,
  TrueFalseQuestion,
  ImageTapQuestion,
  StepOrderQuestion,
  AudioDiscriminationQuestion
} from '../src/models/question.types';

describe('AnswerEvaluator Engine', () => {
  // 1. MCQ Evaluation
  it('correctly evaluates valid MCQ answer', () => {
    const mcq: MCQQuestion = {
      question_id: 'TEST_MCQ',
      category: 'DEVICE_HANDLING',
      type: 'MCQ',
      difficulty: 'BEGINNER',
      question: 'Test MCQ Question',
      option_a: 'Alpha',
      option_b: 'Beta',
      option_c: 'Gamma',
      option_d: 'Delta',
      correct_answer: 'option_b',
      explanation: 'Beta is correct',
      learning_objective: 'Test objective',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };

    const correctRes = AnswerEvaluator.evaluate(mcq, { type: 'MCQ', selected_option: 'option_b' });
    expect(correctRes.is_correct).toBe(true);
    expect(correctRes.awarded_xp).toBe(5);

    const incorrectRes = AnswerEvaluator.evaluate(mcq, { type: 'MCQ', selected_option: 'option_a' });
    expect(incorrectRes.is_correct).toBe(false);
    expect(incorrectRes.awarded_xp).toBe(0);
  });

  // 2. TRUE_FALSE Evaluation
  it('correctly evaluates TRUE_FALSE answer', () => {
    const tf: TrueFalseQuestion = {
      question_id: 'TEST_TF',
      category: 'OPERATING_PROCEDURE',
      type: 'TRUE_FALSE',
      difficulty: 'BEGINNER',
      question: 'Statement is false',
      correct_answer: false,
      explanation: 'Explanation for false',
      learning_objective: 'TF objective',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };

    const correctRes = AnswerEvaluator.evaluate(tf, { type: 'TRUE_FALSE', selected_boolean: false });
    expect(correctRes.is_correct).toBe(true);
    expect(correctRes.awarded_xp).toBe(5);

    const incorrectRes = AnswerEvaluator.evaluate(tf, { type: 'TRUE_FALSE', selected_boolean: true });
    expect(incorrectRes.is_correct).toBe(false);
    expect(incorrectRes.awarded_xp).toBe(0);
  });

  // 3. IMAGE_TAP Evaluation
  it('correctly evaluates IMAGE_TAP hit within target zone and tolerance', () => {
    const imgTap: ImageTapQuestion = {
      question_id: 'TEST_IMG',
      category: 'ANATOMICAL_PLACEMENT',
      type: 'IMAGE_TAP',
      difficulty: 'INTERMEDIATE',
      question: 'Tap the apex',
      image_asset: '/test.svg',
      target_zone: {
        x_min_percent: 50,
        y_min_percent: 50,
        x_max_percent: 70,
        y_max_percent: 70,
        label: 'Apex Zone'
      },
      tolerance_radius_percent: 5,
      explanation: 'Apex explanation',
      learning_objective: 'Image objective',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };

    // Direct hit
    const hitRes = AnswerEvaluator.evaluate(imgTap, {
      type: 'IMAGE_TAP',
      tap_coordinate: { x_percent: 60, y_percent: 60 }
    });
    expect(hitRes.is_correct).toBe(true);
    expect(hitRes.awarded_xp).toBe(10);

    // Near hit within 5% tolerance
    const toleranceHit = AnswerEvaluator.evaluate(imgTap, {
      type: 'IMAGE_TAP',
      tap_coordinate: { x_percent: 48, y_percent: 60 }
    });
    expect(toleranceHit.is_correct).toBe(true);

    // Complete miss
    const missRes = AnswerEvaluator.evaluate(imgTap, {
      type: 'IMAGE_TAP',
      tap_coordinate: { x_percent: 10, y_percent: 10 }
    });
    expect(missRes.is_correct).toBe(false);
    expect(missRes.awarded_xp).toBe(0);
  });

  // 4. STEP_ORDER Evaluation
  it('correctly evaluates STEP_ORDER sequencing', () => {
    const stepQ: StepOrderQuestion = {
      question_id: 'TEST_STEP',
      category: 'OPERATING_PROCEDURE',
      type: 'STEP_ORDER',
      difficulty: 'INTERMEDIATE',
      question: 'Order the steps',
      initial_steps: [
        { id: 'step_2', text: 'Second' },
        { id: 'step_1', text: 'First' },
        { id: 'step_3', text: 'Third' }
      ],
      correct_step_order: ['step_1', 'step_2', 'step_3'],
      explanation: 'Step explanation',
      learning_objective: 'Step objective',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };

    const correctRes = AnswerEvaluator.evaluate(stepQ, {
      type: 'STEP_ORDER',
      ordered_step_ids: ['step_1', 'step_2', 'step_3']
    });
    expect(correctRes.is_correct).toBe(true);
    expect(correctRes.awarded_xp).toBe(10);

    const wrongRes = AnswerEvaluator.evaluate(stepQ, {
      type: 'STEP_ORDER',
      ordered_step_ids: ['step_2', 'step_1', 'step_3']
    });
    expect(wrongRes.is_correct).toBe(false);
    expect(wrongRes.awarded_xp).toBe(0);
  });

  // 5. AUDIO_DISCRIMINATION Evaluation
  it('correctly evaluates AUDIO_DISCRIMINATION selection', () => {
    const audioQ: AudioDiscriminationQuestion = {
      question_id: 'TEST_AUD',
      category: 'QUALITY_ASSESSMENT',
      type: 'AUDIO_DISCRIMINATION',
      difficulty: 'ADVANCED',
      question: 'Which sound is clear?',
      audio_asset_a: '/noisy.mp3',
      audio_asset_b: '/clear.mp3',
      label_a: 'Recording A',
      label_b: 'Recording B',
      correct_audio: 'audio_b',
      clinical_finding: 'Clear S1-S2 rhythm',
      explanation: 'Recording B has high clarity',
      learning_objective: 'Audio objective',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };

    const correctRes = AnswerEvaluator.evaluate(audioQ, {
      type: 'AUDIO_DISCRIMINATION',
      selected_audio: 'audio_b'
    });
    expect(correctRes.is_correct).toBe(true);
    expect(correctRes.awarded_xp).toBe(10);

    const wrongRes = AnswerEvaluator.evaluate(audioQ, {
      type: 'AUDIO_DISCRIMINATION',
      selected_audio: 'audio_a'
    });
    expect(wrongRes.is_correct).toBe(false);
    expect(wrongRes.status).toBe('INCORRECT');
    expect(wrongRes.awarded_xp).toBe(0);
  });

  // 6. Defensive Unanswered Evaluation
  it('returns UNANSWERED status without error for null/undefined/empty payloads', () => {
    const mcq: MCQQuestion = {
      question_id: 'DEF_MCQ',
      category: 'DEVICE_HANDLING',
      type: 'MCQ',
      difficulty: 'BEGINNER',
      question: 'Test Question',
      option_a: 'A',
      option_b: 'B',
      option_c: 'C',
      option_d: 'D',
      correct_answer: 'option_a',
      explanation: 'Explanation',
      learning_objective: 'Objective',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };

    // Null payload
    const nullRes = AnswerEvaluator.evaluate(mcq, null);
    expect(nullRes.status).toBe('UNANSWERED');
    expect(nullRes.is_correct).toBe(false);
    expect(nullRes.awarded_xp).toBe(0);

    // Undefined payload
    const undefRes = AnswerEvaluator.evaluate(mcq, undefined);
    expect(undefRes.status).toBe('UNANSWERED');
    expect(undefRes.is_correct).toBe(false);
    expect(undefRes.awarded_xp).toBe(0);

    // Invalid MCQ selection
    // @ts-expect-error testing invalid payload
    const invalidOptionRes = AnswerEvaluator.evaluate(mcq, { type: 'MCQ', selected_option: 'invalid' });
    expect(invalidOptionRes.status).toBe('UNANSWERED');
    expect(invalidOptionRes.is_correct).toBe(false);

    // Image Tap with missing/NaN coordinates
    const imgTap: ImageTapQuestion = {
      question_id: 'DEF_IMG',
      category: 'ANATOMICAL_PLACEMENT',
      type: 'IMAGE_TAP',
      difficulty: 'INTERMEDIATE',
      question: 'Tap area',
      image_asset: '/test.svg',
      target_zone: { x_min_percent: 10, y_min_percent: 10, x_max_percent: 20, y_max_percent: 20 },
      explanation: 'Exp',
      learning_objective: 'Obj',
      tags: ['test'],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };
    // @ts-expect-error testing incomplete coordinates
    const invalidTapRes = AnswerEvaluator.evaluate(imgTap, { type: 'IMAGE_TAP', tap_coordinate: {} });
    expect(invalidTapRes.status).toBe('UNANSWERED');
    expect(invalidTapRes.is_correct).toBe(false);
  });

  // 7. Test cases 1-9: isValidAnswer and submit enablement
  it('correctly reports isValidAnswer across all 5 question types for UI submit-state gating', () => {
    const mcq: MCQQuestion = {
      question_id: 'Q_MCQ',
      category: 'DEVICE_HANDLING',
      type: 'MCQ',
      difficulty: 'BEGINNER',
      question: 'MCQ',
      option_a: 'A',
      option_b: 'B',
      option_c: 'C',
      option_d: 'D',
      correct_answer: 'option_a',
      explanation: 'Exp',
      learning_objective: 'Obj',
      tags: [],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };
    // TEST 1: MCQ with no selection -> invalid (Submit disabled)
    expect(AnswerEvaluator.isValidAnswer(mcq, null)).toBe(false);
    expect(AnswerEvaluator.isValidAnswer(mcq, undefined)).toBe(false);
    // TEST 2 & 3: MCQ with valid selection -> valid (Submit enabled)
    expect(AnswerEvaluator.isValidAnswer(mcq, { type: 'MCQ', selected_option: 'option_a' })).toBe(true);
    expect(AnswerEvaluator.isValidAnswer(mcq, { type: 'MCQ', selected_option: 'option_b' })).toBe(true);

    const tf: TrueFalseQuestion = {
      question_id: 'Q_TF',
      category: 'OPERATING_PROCEDURE',
      type: 'TRUE_FALSE',
      difficulty: 'BEGINNER',
      question: 'TF',
      correct_answer: true,
      explanation: 'Exp',
      learning_objective: 'Obj',
      tags: [],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };
    // TEST 4: True/False with no selection -> invalid
    expect(AnswerEvaluator.isValidAnswer(tf, null)).toBe(false);
    expect(AnswerEvaluator.isValidAnswer(tf, { type: 'TRUE_FALSE', selected_boolean: true })).toBe(true);
    expect(AnswerEvaluator.isValidAnswer(tf, { type: 'TRUE_FALSE', selected_boolean: false })).toBe(true);

    const imgTap: ImageTapQuestion = {
      question_id: 'Q_IMG',
      category: 'ANATOMICAL_PLACEMENT',
      type: 'IMAGE_TAP',
      difficulty: 'INTERMEDIATE',
      question: 'Tap',
      image_asset: '/test.svg',
      target_zone: { x_min_percent: 10, y_min_percent: 10, x_max_percent: 20, y_max_percent: 20 },
      explanation: 'Exp',
      learning_objective: 'Obj',
      tags: [],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };
    // TEST 5: Image tap with no tap -> invalid
    expect(AnswerEvaluator.isValidAnswer(imgTap, null)).toBe(false);
    // TEST 6: Image tap with valid coordinates -> valid
    expect(AnswerEvaluator.isValidAnswer(imgTap, { type: 'IMAGE_TAP', tap_coordinate: { x_percent: 15, y_percent: 15 } })).toBe(true);

    const aud: AudioDiscriminationQuestion = {
      question_id: 'Q_AUD',
      category: 'QUALITY_ASSESSMENT',
      type: 'AUDIO_DISCRIMINATION',
      difficulty: 'ADVANCED',
      question: 'Audio',
      audio_asset_a: '/a.mp3',
      audio_asset_b: '/b.mp3',
      correct_audio: 'audio_a',
      clinical_finding: 'Finding',
      explanation: 'Exp',
      learning_objective: 'Obj',
      tags: [],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };
    // TEST 7: Audio with no selection -> invalid
    expect(AnswerEvaluator.isValidAnswer(aud, null)).toBe(false);
    // TEST 8: Audio with selection -> valid
    expect(AnswerEvaluator.isValidAnswer(aud, { type: 'AUDIO_DISCRIMINATION', selected_audio: 'audio_a' })).toBe(true);
    expect(AnswerEvaluator.isValidAnswer(aud, { type: 'AUDIO_DISCRIMINATION', selected_audio: 'audio_b' })).toBe(true);

    const step: StepOrderQuestion = {
      question_id: 'Q_STEP',
      category: 'OPERATING_PROCEDURE',
      type: 'STEP_ORDER',
      difficulty: 'INTERMEDIATE',
      question: 'Step',
      initial_steps: [{ id: 's1', text: 'Step 1' }, { id: 's2', text: 'Step 2' }],
      correct_step_order: ['s1', 's2'],
      explanation: 'Exp',
      learning_objective: 'Obj',
      tags: [],
      clinician_validated: false,
      source: 'DEMO',
      version: '1.0.0'
    };
    // TEST 9: Step order with valid ordering -> valid
    expect(AnswerEvaluator.isValidAnswer(step, null)).toBe(false);
    expect(AnswerEvaluator.isValidAnswer(step, { type: 'STEP_ORDER', ordered_step_ids: ['s2', 's1'] })).toBe(true);
  });
});
