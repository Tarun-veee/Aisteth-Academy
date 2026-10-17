import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QuestionRenderer } from '../src/components/questions/QuestionRenderer';
import {
  Question,
  MCQQuestion,
  TrueFalseQuestion,
  ImageTapQuestion,
  StepOrderQuestion,
  AudioDiscriminationQuestion,
  normalizeQuestion
} from '../src/models/question.types';
import { AnswerEvaluator } from '../src/services/AnswerEvaluator';
import { toSafeQuestionDTO } from '../backend/src/application/dtos/question.dto';
import { FirestoreQuestionRepository } from '../backend/src/infrastructure/firestore/FirestoreQuestionRepository';

describe('Question Rendering & DTO Contract Suite', () => {
  const repo = new FirestoreQuestionRepository();

  // --------------------------------------------------------------------------
  // SECTION A: Canonical Affected Question Rendering (MG-EXE-01-TH)
  // --------------------------------------------------------------------------
  describe('Canonical Affected Question (MG-EXE-01-TH)', () => {
    it('loads MG-EXE-01-TH from dataset and verifies canonical content', async () => {
      const q = await repo.getQuestionById('MG-EXE-01-TH');
      expect(q).not.toBeNull();
      expect(q!.question_id).toBe('MG-EXE-01-TH');
      expect(q!.type).toBe('MCQ');
      expect(q!.question_type).toBe('Primary');
      expect(q!.question).toBe(
        'A school-aged child is unable to keep up with their classmates during physical activities and becomes unusually breathless. What is the best action to take?'
      );
      const mcq = q as MCQQuestion;
      expect(mcq.option_a).toBe('Encourage the child to try harder and keep up with the others.');
      expect(mcq.option_b).toBe('Tell the child to ignore it and play normally.');
      expect(mcq.option_c).toBe('Give a glass of water and tell the child to rest.');
      expect(mcq.option_d).toBe('Refer the child to a doctor for a cardiac check-up.');
      expect(mcq.correct_answer).toBe('option_d');
    });

    it('renders MG-EXE-01-TH without "Unsupported question type." and displays all 4 choices in order', async () => {
      const canonicalQ = await repo.getQuestionById('MG-EXE-01-TH');
      expect(canonicalQ).not.toBeNull();

      // Transform through backend DTO sanitization
      const safeDto = toSafeQuestionDTO(canonicalQ!);
      // Normalize on frontend reception
      const clientQ = normalizeQuestion(safeDto);

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: clientQ,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      // Must NOT render error box
      expect(html).not.toContain('Unsupported question type.');

      // Must display all 4 options verbatim
      expect(html).toContain('Encourage the child to try harder and keep up with the others.');
      expect(html).toContain('Tell the child to ignore it and play normally.');
      expect(html).toContain('Give a glass of water and tell the child to rest.');
      expect(html).toContain('Refer the child to a doctor for a cardiac check-up.');

      // Must preserve option order (A before B before C before D)
      const posA = html.indexOf('Encourage the child to try harder');
      const posB = html.indexOf('Tell the child to ignore it');
      const posC = html.indexOf('Give a glass of water');
      const posD = html.indexOf('Refer the child to a doctor');

      expect(posA).toBeGreaterThan(-1);
      expect(posB).toBeGreaterThan(posA);
      expect(posC).toBeGreaterThan(posB);
      expect(posD).toBeGreaterThan(posC);
    });

    it('renders raw SafeQuestionDTO directly in QuestionRenderer without error', async () => {
      const canonicalQ = await repo.getQuestionById('MG-EXE-01-TH');
      const safeDto = toSafeQuestionDTO(canonicalQ!);

      // Pass safeDto directly as question prop
      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: safeDto as any,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).not.toContain('Unsupported question type.');
      expect(html).toContain('Refer the child to a doctor for a cardiac check-up.');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION B: API & DTO Security Boundary
  // --------------------------------------------------------------------------
  describe('API & DTO Security Boundary', () => {
    it('preserves question type while strictly omitting sensitive answers and clinical guidance', async () => {
      const canonicalQ = await repo.getQuestionById('MG-EXE-01-TH');
      const safeDto = toSafeQuestionDTO(canonicalQ!);

      // Type and format preserved
      expect(safeDto.type).toBe('MCQ');
      expect(safeDto.questionId).toBe('MG-EXE-01-TH');
      expect(safeDto.questionType).toBe('Primary');
      expect(safeDto.difficulty).toBe('BEGINNER');

      // Options preserved
      expect(safeDto.options.option_a).toBe('Encourage the child to try harder and keep up with the others.');
      expect(safeDto.options.option_b).toBe('Tell the child to ignore it and play normally.');
      expect(safeDto.options.option_c).toBe('Give a glass of water and tell the child to rest.');
      expect(safeDto.options.option_d).toBe('Refer the child to a doctor for a cardiac check-up.');

      // Strict security boundary: NO answer leakage
      expect((safeDto as any).correct_answer).toBeUndefined();
      expect((safeDto as any).Correct).toBeUndefined();
      expect((safeDto as any).explanation).toBeUndefined();
      expect((safeDto as any).Explanation).toBeUndefined();
      expect((safeDto as any).action).toBeUndefined();
      expect((safeDto as any).Action).toBeUndefined();
      expect((safeDto as any).learning_objective).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // SECTION C: All 5 Supported Question Types Render Correctly
  // --------------------------------------------------------------------------
  describe('All 5 Supported Question Types', () => {
    it('renders MCQ question type correctly', () => {
      const mcq: MCQQuestion = {
        question_id: 'TEST-MCQ-01',
        type: 'MCQ',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        question: 'What is the standard stethoscope placement?',
        option_a: 'Mitral area',
        option_b: 'Tricuspid area',
        option_c: 'Aortic area',
        option_d: 'Pulmonic area',
        explanation: '',
        learning_objective: '',
        tags: [],
        clinician_validated: true,
        source: 'CLINICAL',
        version: '1.0.0',
      };

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: mcq,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).not.toContain('Unsupported question type.');
      expect(html).toContain('Mitral area');
      expect(html).toContain('Tricuspid area');
    });

    it('renders TRUE_FALSE question type correctly', () => {
      const tf: TrueFalseQuestion = {
        question_id: 'TEST-TF-01',
        type: 'TRUE_FALSE',
        category: 'DEVICE_HANDLING',
        difficulty: 'BEGINNER',
        question: 'The stethoscope must be cleaned between patients.',
        correct_answer: true,
        explanation: '',
        learning_objective: '',
        tags: [],
        clinician_validated: true,
        source: 'CLINICAL',
        version: '1.0.0',
      };

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: tf,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).not.toContain('Unsupported question type.');
      expect(html).toContain('TRUE');
      expect(html).toContain('FALSE');
    });

    it('renders IMAGE_TAP question type correctly', () => {
      const imgTap: ImageTapQuestion = {
        question_id: 'TEST-IMG-01',
        type: 'IMAGE_TAP',
        category: 'ANATOMICAL_PLACEMENT',
        difficulty: 'INTERMEDIATE',
        question: 'Tap the apex of the heart.',
        image_asset: '/images/torso.png',
        target_zone: {
          x_min_percent: 40,
          y_min_percent: 60,
          x_max_percent: 50,
          y_max_percent: 70,
          label: 'Apex',
        },
        explanation: '',
        learning_objective: '',
        tags: [],
        clinician_validated: true,
        source: 'CLINICAL',
        version: '1.0.0',
      };

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: imgTap,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).not.toContain('Unsupported question type.');
    });

    it('renders STEP_ORDER question type correctly', () => {
      const stepOrder: StepOrderQuestion = {
        question_id: 'TEST-STEP-01',
        type: 'STEP_ORDER',
        category: 'OPERATING_PROCEDURE',
        difficulty: 'INTERMEDIATE',
        question: 'Order the clinical steps for cardiac examination.',
        initial_steps: [
          { id: 's1', text: 'Wash hands' },
          { id: 's2', text: 'Warm stethoscope' },
          { id: 's3', text: 'Auscultate apex' },
        ],
        correct_step_order: ['s1', 's2', 's3'],
        explanation: '',
        learning_objective: '',
        tags: [],
        clinician_validated: true,
        source: 'CLINICAL',
        version: '1.0.0',
      };

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: stepOrder,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).not.toContain('Unsupported question type.');
      expect(html).toContain('Wash hands');
      expect(html).toContain('Warm stethoscope');
    });

    it('renders AUDIO_DISCRIMINATION question type correctly', () => {
      const audioDisc: AudioDiscriminationQuestion = {
        question_id: 'TEST-AUD-01',
        type: 'AUDIO_DISCRIMINATION',
        category: 'QUALITY_ASSESSMENT',
        difficulty: 'ADVANCED',
        question: 'Select the recording showing clear S1 and S2 without artifact.',
        audio_asset_a: '/audio/sample_a.mp3',
        audio_asset_b: '/audio/sample_b.mp3',
        correct_audio: 'audio_a',
        clinical_finding: 'Normal heart sound',
        explanation: '',
        learning_objective: '',
        tags: [],
        clinician_validated: true,
        source: 'CLINICAL',
        version: '1.0.0',
      };

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: audioDisc,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).not.toContain('Unsupported question type.');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION D: Genuinely Unsupported / Malformed Types Fail Closed Safely
  // --------------------------------------------------------------------------
  describe('Unsupported Question Types Handling', () => {
    it('safely renders "Unsupported question type." for unknown question type', () => {
      const unknownQ = {
        question_id: 'TEST-UNKNOWN-01',
        type: 'DRAG_AND_DROP_PUZZLE',
        question: 'Solve this puzzle',
      } as any;

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: unknownQ,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).toContain('Unsupported question type.');
    });

    it('does NOT convert unknown question types to MCQ silently', () => {
      const rawUnknown = {
        question_id: 'TEST-CUSTOM-01',
        type: 'SURVEY_RATING',
        question: 'Rate your confidence from 1 to 5',
      };

      const normalized = normalizeQuestion(rawUnknown);
      expect(normalized.type).toBe('SURVEY_RATING');

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: normalized,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).toContain('Unsupported question type.');
    });

    it('renders "Unsupported question type." if question object is missing type without options', () => {
      const emptyQ = {
        question_id: 'TEST-EMPTY-01',
        question: 'Question with no type and no options',
      } as any;

      const normalized = normalizeQuestion(emptyQ);
      expect(normalized.type).toBeUndefined();

      const html = renderToString(
        React.createElement(QuestionRenderer, {
          question: normalized,
          currentAnswer: null,
          onAnswerChange: () => {},
          evaluation: null,
          isSubmitted: false,
        })
      );

      expect(html).toContain('Unsupported question type.');
    });
  });

  // --------------------------------------------------------------------------
  // SECTION E: Answer Submission & Lineage Verification
  // --------------------------------------------------------------------------
  describe('Answer Submission & Lineage Verification', () => {
    it('validates selected option payload for MG-EXE-01-TH', async () => {
      const canonicalQ = await repo.getQuestionById('MG-EXE-01-TH');
      const safeDto = toSafeQuestionDTO(canonicalQ!);
      const clientQ = normalizeQuestion(safeDto);

      // Invalid payload
      expect(AnswerEvaluator.isValidAnswer(clientQ, null)).toBe(false);
      expect(AnswerEvaluator.isValidAnswer(clientQ, { type: 'MCQ', selected_option: 'option_e' as any })).toBe(false);

      // Valid payload
      expect(AnswerEvaluator.isValidAnswer(clientQ, { type: 'MCQ', selected_option: 'option_d' })).toBe(true);
    });

    it('resolves canonical follow-up MG-EXE-01-PR for MG-EXE-01-TH', async () => {
      const followUp = await repo.getFollowUpQuestion('MG-EXE-01-TH');
      expect(followUp).not.toBeNull();
      expect(followUp!.question_id).toBe('MG-EXE-01-PR');
      expect(followUp!.follow_up_for).toBe('MG-EXE-01-TH');
      expect(followUp!.question_type).toBe('Follow-Up');

      const safeFollowUpDto = toSafeQuestionDTO(followUp!);
      expect(safeFollowUpDto.type).toBe('MCQ');
      expect(safeFollowUpDto.questionType).toBe('Follow-Up');
      expect(safeFollowUpDto.followUpFor).toBe('MG-EXE-01-TH');
    });
  });
});
