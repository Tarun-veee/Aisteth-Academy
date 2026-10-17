import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnswerEvaluator } from '../src/services/AnswerEvaluator';
import { QuestionReviewScreen } from '../src/views/QuestionReviewScreen';
import { StepOrderRenderer } from '../src/components/questions/StepOrderRenderer';
import { AudioDiscriminationRenderer } from '../src/components/questions/AudioDiscriminationRenderer';
import { MCQRenderer } from '../src/components/questions/MCQRenderer';
import { ImageTapRenderer } from '../src/components/questions/ImageTapRenderer';
import { MCQQuestion, TrueFalseQuestion, ImageTapQuestion, StepOrderQuestion, AudioDiscriminationQuestion } from '../src/models/question.types';

describe('Mobile Viewport Layout & Submit Gating Tests', () => {
  const sampleMCQ: MCQQuestion = {
    question_id: 'DEMO_MCQ_001',
    type: 'MCQ',
    category: 'DEVICE_HANDLING',
    difficulty: 'BEGINNER',
    question: 'What should you check on the AiSteth device before beginning an auscultation recording?',
    option_a: 'Ensure device power is on and battery indicator is green',
    option_b: "Check the patient's height and weight record",
    option_c: 'Ensure the room temperature is below 20°C',
    option_d: 'Check the mobile SIM card balance',
    correct_answer: 'option_a',
    explanation: 'Always ensure the AiSteth has sufficient battery charge and is powered on before starting.',
    source: 'DEMO',
    clinician_validated: false,
    version: '1.0.0',
  };

  const sampleTF: TrueFalseQuestion = {
    question_id: 'DEMO_TF_001',
    type: 'TRUE_FALSE',
    category: 'DEVICE_HANDLING',
    difficulty: 'BEGINNER',
    question: 'The AiSteth diaphragm should be held firmly against bare skin without moving during recording.',
    correct_answer: true,
    explanation: 'Firm, stationary contact with bare skin ensures clear acoustic signal transmission.',
    source: 'DEMO',
    clinician_validated: false,
    version: '1.0.0',
  };

  const sampleImageTap: ImageTapQuestion = {
    question_id: 'DEMO_TAP_001',
    type: 'IMAGE_TAP',
    category: 'ANATOMICAL_PLACEMENT',
    difficulty: 'BEGINNER',
    question: 'Tap the Mitral (Apex) auscultation area on the chest diagram.',
    image_asset: '/assets/images/chest_auscultation_points.svg',
    target_zone: {
      x_min_percent: 55,
      y_min_percent: 60,
      x_max_percent: 75,
      y_max_percent: 80,
      label: 'Mitral / Apex Area',
    },
    explanation: 'The Mitral area is located at the 5th intercostal space, left midclavicular line.',
    source: 'DEMO',
    clinician_validated: false,
    version: '1.0.0',
  };

  const sampleStepOrder: StepOrderQuestion = {
    question_id: 'DEMO_STEP_001',
    type: 'STEP_ORDER',
    category: 'DEVICE_HANDLING',
    difficulty: 'INTERMEDIATE',
    question: 'Arrange the clinical recording steps in correct chronological order:',
    initial_steps: [
      { id: 'step_3', text: 'Start 15-second recording on mobile app' },
      { id: 'step_1', text: 'Power on AiSteth and connect Bluetooth' },
      { id: 'step_2', text: 'Place diaphragm at target anatomical landmark' },
    ],
    correct_step_order: ['step_1', 'step_2', 'step_3'],
    explanation: 'First connect, then position diaphragm, then initiate app recording.',
    source: 'DEMO',
    clinician_validated: false,
    version: '1.0.0',
  };

  const sampleAudio: AudioDiscriminationQuestion = {
    question_id: 'DEMO_AUDIO_001',
    type: 'AUDIO_DISCRIMINATION',
    category: 'AUDIO_QUALITY',
    difficulty: 'INTERMEDIATE',
    question: 'Listen to both recordings and select the clear recording without motion artifact:',
    audio_asset_a: '/assets/audio/clear_s1_s2.mp3',
    audio_asset_b: '/assets/audio/noisy_friction.mp3',
    label_a: 'Recording A (Standard Placement)',
    label_b: 'Recording B (Friction Artifact)',
    correct_choice: 'audio_a',
    clinical_finding: 'Clear physiological S1 and S2 heart sounds with zero rubbing friction artifact.',
    explanation: 'Recording A shows clear heart sounds, while Recording B contains rubbing artifact.',
    source: 'DEMO',
    clinician_validated: false,
    version: '1.0.0',
  };

  it('Submit button gating: disables when unselected, enables on selection for MCQ', () => {
    // Unselected
    expect(AnswerEvaluator.isValidAnswer(sampleMCQ, null)).toBe(false);
    expect(AnswerEvaluator.isValidAnswer(sampleMCQ, { type: 'MCQ', selected_option: '' as any })).toBe(false);

    // Selected
    expect(AnswerEvaluator.isValidAnswer(sampleMCQ, { type: 'MCQ', selected_option: 'option_a' })).toBe(true);
    expect(AnswerEvaluator.isValidAnswer(sampleMCQ, { type: 'MCQ', selected_option: 'option_d' })).toBe(true);
  });

  it('Submit button gating: disables when unselected, enables on selection for TRUE_FALSE', () => {
    // Unselected
    expect(AnswerEvaluator.isValidAnswer(sampleTF, null)).toBe(false);

    // Selected
    expect(AnswerEvaluator.isValidAnswer(sampleTF, { type: 'TRUE_FALSE', selected_boolean: true })).toBe(true);
    expect(AnswerEvaluator.isValidAnswer(sampleTF, { type: 'TRUE_FALSE', selected_boolean: false })).toBe(true);
  });

  it('Submit button gating: disables when unselected, enables on coordinate selection for IMAGE_TAP', () => {
    // Unselected / incomplete
    expect(AnswerEvaluator.isValidAnswer(sampleImageTap, null)).toBe(false);
    expect(AnswerEvaluator.isValidAnswer(sampleImageTap, { type: 'IMAGE_TAP', tap_coordinate: { x_percent: NaN, y_percent: 50 } })).toBe(false);

    // Selected
    expect(AnswerEvaluator.isValidAnswer(sampleImageTap, { type: 'IMAGE_TAP', tap_coordinate: { x_percent: 65, y_percent: 70 } })).toBe(true);
  });

  it('Submit button gating: validates step ordering arrays for STEP_ORDER', () => {
    // Unselected / incomplete
    expect(AnswerEvaluator.isValidAnswer(sampleStepOrder, null)).toBe(false);
    expect(AnswerEvaluator.isValidAnswer(sampleStepOrder, { type: 'STEP_ORDER', ordered_step_ids: [] })).toBe(false);

    // Selected
    expect(AnswerEvaluator.isValidAnswer(sampleStepOrder, { type: 'STEP_ORDER', ordered_step_ids: ['step_1', 'step_2', 'step_3'] })).toBe(true);
  });

  it('Submit button gating: disables when unselected, enables on selection for AUDIO_DISCRIMINATION', () => {
    // Unselected
    expect(AnswerEvaluator.isValidAnswer(sampleAudio, null)).toBe(false);

    // Selected
    expect(AnswerEvaluator.isValidAnswer(sampleAudio, { type: 'AUDIO_DISCRIMINATION', selected_audio: 'audio_a' })).toBe(true);
    expect(AnswerEvaluator.isValidAnswer(sampleAudio, { type: 'AUDIO_DISCRIMINATION', selected_audio: 'audio_b' })).toBe(true);
  });

  it('Evaluator handles evaluations correctly with status enum', () => {
    const correctRes = AnswerEvaluator.evaluate(sampleMCQ, { type: 'MCQ', selected_option: 'option_a' });
    expect(correctRes.status).toBe('CORRECT');
    expect(correctRes.is_correct).toBe(true);
    expect(correctRes.awarded_xp).toBe(5);

    const incorrectRes = AnswerEvaluator.evaluate(sampleMCQ, { type: 'MCQ', selected_option: 'option_c' });
    expect(incorrectRes.status).toBe('INCORRECT');
    expect(incorrectRes.is_correct).toBe(false);
    expect(incorrectRes.awarded_xp).toBe(0);

    const unansRes = AnswerEvaluator.evaluate(sampleMCQ, null);
    expect(unansRes.status).toBe('UNANSWERED');
    expect(unansRes.is_correct).toBe(false);
    expect(unansRes.awarded_xp).toBe(0);
  });

  it('Feedback data structure retains question context, explanation, and solution display', () => {
    const evalRes = AnswerEvaluator.evaluate(sampleMCQ, { type: 'MCQ', selected_option: 'option_b' });
    expect(evalRes.status).toBe('INCORRECT');
    expect(evalRes.is_correct).toBe(false);
    expect(evalRes.correct_solution_display).toContain('Ensure device power is on');
    expect(evalRes.explanation).toBeTruthy();
    expect(evalRes.question_id).toBe('DEMO_MCQ_001');
    expect(evalRes.user_payload).toEqual({ type: 'MCQ', selected_option: 'option_b' });
  });

  describe('Target Mobile Viewport Verification & Real Component DOM Layout (TEST-001)', () => {
    it('verifies StepOrderRenderer reorder controls enforce >=44x44px touch targets', () => {
      const html = renderToString(
        React.createElement(StepOrderRenderer, {
          question: sampleStepOrder,
        })
      );
      expect(html).toContain('min-w-[44px]');
      expect(html).toContain('min-h-[44px]');
      expect(html).toContain('touch-manipulation');
    });

    it('verifies AudioDiscriminationRenderer renders accessible radiogroup with keyboard-operable cards', () => {
      const html = renderToString(
        React.createElement(AudioDiscriminationRenderer, {
          question: sampleAudio,
        })
      );
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('role="radio"');
      expect(html).toContain('aria-checked');
      expect(html).toContain('tabindex="0"');
    });

    it('verifies MCQRenderer aligns badges with items-start on multiline options', () => {
      const html = renderToString(
        React.createElement(MCQRenderer, {
          question: sampleMCQ,
        })
      );
      expect(html).toContain('items-start');
    });

    it('verifies ImageTapRenderer renders accessible application role and keyboard instructions', () => {
      const html = renderToString(
        React.createElement(ImageTapRenderer, {
          question: sampleImageTap,
        })
      );
      expect(html).toContain('role="application"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('arrow keys');
    });
  });

  describe('Regression Test: QuestionReviewScreen Header Responsive Wrapping (UI-001)', () => {
    const longAudioQuestion: any = {
      question_id: 'DEMO_AUDIO_001',
      type: 'AUDIO_DISCRIMINATION',
      category: 'QUALITY_ASSESSMENT',
      difficulty: 'INTERMEDIATE',
      question: 'Listen to both recordings and select the clear recording without motion artifact:',
      audio_asset_a: '/assets/audio/clear_s1_s2.mp3',
      audio_asset_b: '/assets/audio/noisy_friction.mp3',
      label_a: 'Recording A (Standard Placement)',
      label_b: 'Recording B (Friction Artifact)',
      correct_choice: 'audio_a',
      clinical_finding: 'Clear physiological S1 and S2 heart sounds with zero rubbing friction artifact.',
      explanation: 'Recording A shows clear heart sounds, while Recording B contains rubbing artifact.',
      source: 'DEMO',
      clinician_validated: false,
      version: '1.0.0',
    };

    it('renders Q10 • AUDIO_DISCRIMINATION [QUALITY_ASSESSMENT] with full "Needs Review" status badge and responsive wrapping classes', () => {
      const historyItem = {
        questionId: 'DEMO_AUDIO_001',
        question: longAudioQuestion,
        userAnswer: { type: 'AUDIO_DISCRIMINATION' as const, selected_audio: 'audio_b' as const },
        evaluation: {
          question_id: 'DEMO_AUDIO_001',
          is_correct: false,
          status: 'INCORRECT' as const,
          awarded_xp: 0,
          explanation: 'Recording A shows clear heart sounds.',
          correct_solution_display: 'Recording A',
        },
        timestamp: Date.now(),
      };

      const html = renderToString(
        React.createElement(QuestionReviewScreen, {
          history: Array(9).fill(historyItem).concat([historyItem]),
          onDone: () => {},
        })
      );

      // Verify Q10 and metadata badges are rendered
      const cleanHtml = html.replace(/<!-- -->/g, '');
      expect(cleanHtml).toContain('Q10 • AUDIO_DISCRIMINATION');
      expect(cleanHtml).toContain('QUALITY_ASSESSMENT');

      // Verify the entire "Needs Review" status badge is rendered
      expect(cleanHtml).toContain('Needs Review');

      // Verify responsive flex-wrap and shrink-0 classes are applied
      expect(cleanHtml).toContain('flex-wrap');
      expect(cleanHtml).toContain('shrink-0');
    });

    it('renders Q5 • AUDIO_DISCRIMINATION [QUALITY_ASSESSMENT] with full "Correct" status badge and responsive wrapping classes', () => {
      const correctHistoryItem = {
        questionId: 'DEMO_AUDIO_001',
        question: longAudioQuestion,
        userAnswer: { type: 'AUDIO_DISCRIMINATION' as const, selected_audio: 'audio_a' as const },
        evaluation: {
          question_id: 'DEMO_AUDIO_001',
          is_correct: true,
          status: 'CORRECT' as const,
          awarded_xp: 5,
          explanation: 'Recording A shows clear heart sounds.',
          correct_solution_display: 'Recording A',
        },
        timestamp: Date.now(),
      };

      const html = renderToString(
        React.createElement(QuestionReviewScreen, {
          history: Array(4).fill(correctHistoryItem).concat([correctHistoryItem]),
          onDone: () => {},
        })
      );

      // Verify Q5 and metadata badges are rendered
      const cleanHtml = html.replace(/<!-- -->/g, '');
      expect(cleanHtml).toContain('Q5 • AUDIO_DISCRIMINATION');
      expect(cleanHtml).toContain('QUALITY_ASSESSMENT');

      // Verify the entire "Correct" status badge is rendered
      expect(cleanHtml).toContain('Correct');

      // Verify responsive flex-wrap and shrink-0 classes are applied
      expect(cleanHtml).toContain('flex-wrap');
      expect(cleanHtml).toContain('shrink-0');
    });
  });
});
