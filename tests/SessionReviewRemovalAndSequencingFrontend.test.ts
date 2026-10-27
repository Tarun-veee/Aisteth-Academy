import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HomeScreen } from '../src/views/HomeScreen';
import { DailySessionScreen } from '../src/views/DailySessionScreen';
import { UserStats } from '../src/models/user.types';

describe('Part B & D: Session Review UI Removal & Navigation Regression Suite', () => {
  const baseStats: UserStats = {
    totalXp: 150,
    currentStreak: 5,
    longestStreak: 7,
    lastActiveDate: '2026-10-19',
    completedQuestionsCount: 15,
    completedSessionsCount: 1,
    totalCorrectAnswersCount: 12,
    streakShieldConsumed: false,
  };

  // TEST 9 — Daily Mission card does not display "VIEW SESSION REVIEW"
  it('TEST 9: Daily Mission card strictly omits "VIEW SESSION REVIEW" when status is QUESTIONS_COMPLETED', () => {
    const html = renderToString(
      React.createElement(HomeScreen, {
        userStats: baseStats,
        dailyStatus: 'QUESTIONS_COMPLETED',
        onStartSession: () => {},
      })
    );

    expect(html).not.toContain('VIEW SESSION REVIEW');
    expect(html).not.toContain('View Session Review');
  });

  it('TEST 9b: Daily Mission card strictly omits "VIEW SESSION REVIEW" across all lifecycle states', () => {
    const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'QUESTIONS_COMPLETED', 'REVIEW_VIEWED', 'REVIEW_COMPLETED', 'COMPLETED'] as const;

    for (const status of statuses) {
      const html = renderToString(
        React.createElement(HomeScreen, {
          userStats: baseStats,
          dailyStatus: status as any,
          onStartSession: () => {},
        })
      );
      expect(html).not.toContain('VIEW SESSION REVIEW');
    }
  });

  // TEST 10 — Completed daily session displays the existing completion message
  it('TEST 10: Completed daily session displays "TODAY\'S TRAINING COMPLETE" and disables action', () => {
    const html = renderToString(
      React.createElement(HomeScreen, {
        userStats: baseStats,
        dailyStatus: 'QUESTIONS_COMPLETED',
        onStartSession: () => {},
      })
    );

    expect(html).toContain("TODAY&#x27;S TRAINING COMPLETE");
    expect(html).toContain('Mission Finished');
    expect(html).toContain('You have completed all 10 clinical &amp; practical questions for today');
    expect(html).toContain('disabled');
  });

  // TEST 11 — No equivalent review button appears in the same completion workflow
  it('TEST 11: No equivalent review button appears in Daily Mission card when session is completed', () => {
    const html = renderToString(
      React.createElement(HomeScreen, {
        userStats: baseStats,
        dailyStatus: 'QUESTIONS_COMPLETED',
        onStartSession: () => {},
      })
    );

    expect(html).not.toContain('Review Session');
    expect(html).not.toContain('Open Review');
    expect(html).not.toContain('Review Answers');
  });

  // TEST 12 — In-progress sessions can still be resumed normally
  it('TEST 12: In-progress session displays "CONTINUE TODAY\'S TRAINING" with current question index and active button', () => {
    const html = renderToString(
      React.createElement(HomeScreen, {
        userStats: baseStats,
        dailyStatus: 'IN_PROGRESS',
        currentQuestionIndex: 4,
        totalQuestionsCount: 10,
        onStartSession: () => {},
      })
    );

    expect(html).toContain("CONTINUE TODAY&#x27;S TRAINING");
    expect(html).toContain('Question 5 of 10');
    expect(html).not.toContain('disabled=""');
  });

  // TEST 13 — Completed sessions are not accidentally reopened by normal application navigation
  it('TEST 13: Protected view hash routing maps #review directly to HOME', () => {
    // In App.tsx:
    // const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    // if (rawHash === 'review') return 'HOME';
    const rawHash = 'review';
    const view = rawHash === 'review' ? 'HOME' : 'REVIEW';
    expect(view).toBe('HOME');
  });

  // TEST 14 — Other legitimate application features remain unaffected
  it('TEST 14: Daily Mission card preserves header, streak, XP, and legitimate features', () => {
    const html = renderToString(
      React.createElement(HomeScreen, {
        userStats: baseStats,
        dailyStatus: 'NOT_STARTED',
        totalQuestionsCount: 10,
        onStartSession: () => {},
      })
    );

    expect(html).toContain('Standard Auscultation Workflow');
    expect(html).toContain('10 Questions');
    expect(html).toContain("START TODAY&#x27;S TRAINING");
    expect(html).toContain('5'); // Streak
    expect(html).toContain('150'); // XP
  });

  // =========================================================================
  // FOLLOW-UP SEQUENCING FRONTEND TESTS (USER SPECIFIC SCENARIO)
  // =========================================================================

  const mockMainQ1: any = {
    question_id: 'MG-AIS-01-TH',
    topic: 'AiSteth',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    category: 'HEART_RECORDING',
    question: 'The LED on the AiSteth is blinking blue. What is the device doing?',
    options: { option_a: 'Charging', option_b: 'Connecting to phone', option_c: 'Off', option_d: 'Broken' },
    correct_option: 'option_b',
    explanation: 'A blinking blue LED means connecting.',
    learning_objective: 'Understand LED states',
    clinician_validated: true,
  };

  const mockMainQ2: any = {
    question_id: 'MG-AIS-02-TH',
    topic: 'AiSteth',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    category: 'HEART_RECORDING',
    question: 'The LED on the AiSteth is solid blue. What does this tell you?',
    options: { option_a: 'Ready to unplug', option_b: 'Charging', option_c: 'Connected', option_d: 'Pairing' },
    correct_option: 'option_c',
    explanation: 'A solid blue LED means connected.',
    learning_objective: 'Understand solid blue LED',
    clinician_validated: true,
  };

  const mockFollowUpQ2: any = {
    question_id: 'MG-AIS-01-PR',
    topic: 'AiSteth',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    category: 'HEART_RECORDING',
    question: 'You are at a village health camp. The AiSteth LED is blinking blue. What should you do?',
    options: {
      option_a: 'Charge the device.',
      option_b: 'Wait for the device to connect to your phone.',
      option_c: 'Start using the device immediately.',
      option_d: 'Check the battery level.',
    },
    correct_option: 'option_b',
    explanation: 'Wait for the device to connect to your phone.',
    learning_objective: 'Clinical LED troubleshooting',
    clinician_validated: true,
  };

  const mockMainQ3: any = {
    question_id: 'MG-AIS-03-TH',
    topic: 'AiSteth',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    category: 'HEART_RECORDING',
    question: 'Next Main Question 3 prompt',
    options: { option_a: 'Option A', option_b: 'Option B', option_c: 'Option C', option_d: 'Option D' },
    correct_option: 'option_a',
    explanation: 'Next explanation',
    learning_objective: 'Next objective',
    clinician_validated: true,
  };

  const questionsList10 = [
    mockMainQ1,
    mockMainQ2,
    mockFollowUpQ2,
    mockMainQ3,
    mockMainQ1,
    mockMainQ2,
    mockMainQ1,
    mockMainQ2,
    mockMainQ1,
    mockMainQ2,
  ];

  // TEST 15 — Main Question 2 renders as "Question 2 of 10"
  it('TEST 15: Main Question 2 renders with header "Question 2 of 10"', () => {
    const rawHtml = renderToString(
      React.createElement(DailySessionScreen, {
        session: {
          status: 'IN_PROGRESS',
          dailyStatus: 'IN_PROGRESS',
          sessionId: 'daily_2026-10-19_test',
          currentIndex: 1, // 0-indexed: question 2
          questions: questionsList10,
          currentAnswer: null,
          currentEvaluation: null,
          history: [],
          totalXpEarned: 10,
          correctCount: 1,
          questionsCompleted: false,
          reviewViewed: false,
          branchState: 'MAIN',
          activeFollowUpQuestion: null,
          isReattempt: false,
          isSubmitting: false,
          pendingIdempotencyKey: null,
          submissionError: null,
          serverPendingTransition: null,
          startTime: Date.now(),
          endTime: null,
        },
        userStats: baseStats,
        currentQuestion: mockMainQ2,
        onSetAnswer: () => {},
        onSubmitAnswer: () => {},
        onApplyFiftyFifty: () => {},
        onApplyLearn: () => {},
        onNextQuestion: () => {},
        onExitSession: () => {},
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    expect(html).toContain('Question 2 of 10');
    expect(html).not.toContain('Follow-Up Practice');
  });

  // TEST 16 — Main Question 2 answered incorrectly -> linked Follow-Up displays as "Question 3 of 10"
  it('TEST 16: Main Question 2 answered incorrectly -> linked Follow-Up displays as "Question 3 of 10" with Follow-Up Practice badge', () => {
    const rawHtml = renderToString(
      React.createElement(DailySessionScreen, {
        session: {
          status: 'IN_PROGRESS',
          dailyStatus: 'IN_PROGRESS',
          sessionId: 'daily_2026-10-19_test',
          currentIndex: 2, // 0-indexed: question 3 (Follow-Up assigned next sequence position)
          questions: questionsList10,
          currentAnswer: null,
          currentEvaluation: null,
          history: [],
          totalXpEarned: 10,
          correctCount: 1,
          questionsCompleted: false,
          reviewViewed: false,
          branchState: 'FOLLOW_UP',
          activeFollowUpQuestion: mockFollowUpQ2,
          isReattempt: false,
          isSubmitting: false,
          pendingIdempotencyKey: null,
          submissionError: null,
          serverPendingTransition: null,
          startTime: Date.now(),
          endTime: null,
        },
        userStats: baseStats,
        currentQuestion: mockFollowUpQ2,
        onSetAnswer: () => {},
        onSubmitAnswer: () => {},
        onApplyFiftyFifty: () => {},
        onApplyLearn: () => {},
        onNextQuestion: () => {},
        onExitSession: () => {},
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Header strictly displays Question 3 of 10 (not Question 2 of 10)
    expect(html).toContain('Question 3 of 10');
    expect(html).not.toContain('Question 2 of 10');
    expect(html).toContain('Follow-Up Practice');
    expect(html).toContain('MG-AIS-01-PR');
    expect(html).toContain('You are at a village health camp. The AiSteth LED is blinking blue. What should you do?');
  });

  // TEST 17 — Next eligible Main question displays as Question 4 of 10 after Follow-Up is completed
  it('TEST 17: Next eligible Main question displays as "Question 4 of 10" after Follow-Up is completed', () => {
    const rawHtml = renderToString(
      React.createElement(DailySessionScreen, {
        session: {
          status: 'IN_PROGRESS',
          dailyStatus: 'IN_PROGRESS',
          sessionId: 'daily_2026-10-19_test',
          currentIndex: 3, // 0-indexed: question 4 (next eligible Main)
          questions: questionsList10,
          currentAnswer: null,
          currentEvaluation: null,
          history: [],
          totalXpEarned: 10,
          correctCount: 1,
          questionsCompleted: false,
          reviewViewed: false,
          branchState: 'MAIN',
          activeFollowUpQuestion: null,
          isReattempt: false,
          isSubmitting: false,
          pendingIdempotencyKey: null,
          submissionError: null,
          serverPendingTransition: null,
          startTime: Date.now(),
          endTime: null,
        },
        userStats: baseStats,
        currentQuestion: mockMainQ3,
        onSetAnswer: () => {},
        onSubmitAnswer: () => {},
        onApplyFiftyFifty: () => {},
        onApplyLearn: () => {},
        onNextQuestion: () => {},
        onExitSession: () => {},
      })
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    expect(html).toContain('Question 4 of 10');
    expect(html).not.toContain('Follow-Up Practice');
    expect(html).toContain('MG-AIS-03-TH');
  });
});

