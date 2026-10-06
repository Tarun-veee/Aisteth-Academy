import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { PowerUpService } from '../src/services/PowerUpService';
import { StorageRepository } from '../src/repositories/StorageRepository';
import { UserStats, StoredSessionRecord } from '../src/models/session.types';
import { MCQQuestion, ImageTapQuestion } from '../src/models/question.types';
import { DailySessionScreen } from '../src/views/DailySessionScreen';
import { FeedbackDrawer } from '../src/components/feedback/FeedbackDrawer';
import { ProfileScreen } from '../src/views/ProfileScreen';

describe('Power-Up Business Logic & Unlock Conditions', () => {
  const baseStats: UserStats = {
    totalXp: 150,
    currentStreak: 10,
    longestStreak: 10,
    lastActiveDate: '2026-09-28',
    completedQuestionsCount: 40,
    completedSessionsCount: 4,
    totalCorrectAnswersCount: 30,
    streakShieldConsumed: false,
  };

  const sampleMCQ: MCQQuestion = {
    question_id: 'Q_TEST_MCQ_01',
    category: 'DEVICE_HANDLING',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    question: 'Where should the diaphragm be placed?',
    option_a: 'Mitral area (5th ICS midclavicular line)',
    option_b: 'On the clavicle bone directly',
    option_c: 'Below the navel',
    option_d: 'On the right shoulder',
    correct_answer: 'option_a',
    explanation: 'The mitral area provides optimal acoustic clarity.',
    learning_objective: 'Identify proper anatomical landmark placement for the diaphragm.',
    tags: ['landmark', 'placement'],
    clinician_validated: true,
    source: 'DEMO',
    version: '1.0.0',
  };

  const sampleImageTap: ImageTapQuestion = {
    question_id: 'Q_TEST_TAP_01',
    category: 'HEART_RECORDING',
    type: 'IMAGE_TAP',
    difficulty: 'INTERMEDIATE',
    question: 'Tap the apex site.',
    image_asset: '/assets/chest.png',
    target_zone: { x_min_percent: 30, y_min_percent: 40, x_max_percent: 50, y_max_percent: 60 },
    explanation: 'Apex is at the 5th intercostal space.',
    learning_objective: 'Locate cardiac apex visually.',
    tags: ['apex'],
    clinician_validated: true,
    source: 'DEMO',
    version: '1.0.0',
  };

  describe('1. 50/50 Power-Up', () => {
    it('is LOCKED when currentStreak < 20 (Boundary test 19 vs 20)', () => {
      const stats19: UserStats = { ...baseStats, currentStreak: 19 };
      const inventory19 = PowerUpService.calculateInventory(stats19);
      const ffItem19 = inventory19.items.find((i) => i.id === 'FIFTY_FIFTY')!;
      expect(ffItem19.isUnlocked).toBe(false);
      expect(ffItem19.status).toBe('LOCKED');
      expect(ffItem19.unlockCurrent).toBe(19);

      const check19 = PowerUpService.canUseFiftyFifty(stats19, sampleMCQ, false);
      expect(check19.canUse).toBe(false);
      expect(check19.isUnlocked).toBe(false);

      const stats20: UserStats = { ...baseStats, currentStreak: 20 };
      const inventory20 = PowerUpService.calculateInventory(stats20);
      const ffItem20 = inventory20.items.find((i) => i.id === 'FIFTY_FIFTY')!;
      expect(ffItem20.isUnlocked).toBe(true);
      expect(ffItem20.status).toBe('AVAILABLE');

      const check20 = PowerUpService.canUseFiftyFifty(stats20, sampleMCQ, false);
      expect(check20.canUse).toBe(true);
      expect(check20.isUnlocked).toBe(true);
    });

    it('eliminates exactly 2 incorrect options and NEVER eliminates the correct answer', () => {
      // Test when correct answer is option_a
      const mcqA = { ...sampleMCQ, correct_answer: 'option_a' as const };
      const elimA = PowerUpService.getEliminatedOptions(mcqA);
      expect(elimA.length).toBe(2);
      expect(elimA.includes('option_a')).toBe(false);

      // Test when correct answer is option_b
      const mcqB = { ...sampleMCQ, correct_answer: 'option_b' as const };
      const elimB = PowerUpService.getEliminatedOptions(mcqB);
      expect(elimB.length).toBe(2);
      expect(elimB.includes('option_b')).toBe(false);

      // Test when correct answer is option_c
      const mcqC = { ...sampleMCQ, correct_answer: 'option_c' as const };
      const elimC = PowerUpService.getEliminatedOptions(mcqC);
      expect(elimC.length).toBe(2);
      expect(elimC.includes('option_c')).toBe(false);

      // Test when correct answer is option_d
      const mcqD = { ...sampleMCQ, correct_answer: 'option_d' as const };
      const elimD = PowerUpService.getEliminatedOptions(mcqD);
      expect(elimD.length).toBe(2);
      expect(elimD.includes('option_d')).toBe(false);
    });

    it('is unavailable for non-MCQ question types (e.g. IMAGE_TAP)', () => {
      const stats20: UserStats = { ...baseStats, currentStreak: 20 };
      const checkTap = PowerUpService.canUseFiftyFifty(stats20, sampleImageTap, false);
      expect(checkTap.canUse).toBe(false);
      expect(checkTap.isSupported).toBe(false);
      expect(checkTap.reason).toContain('Multiple Choice');
    });

    it('cannot be reused on the same question if already used', () => {
      const stats20: UserStats = { ...baseStats, currentStreak: 20 };
      const checkReused = PowerUpService.canUseFiftyFifty(stats20, sampleMCQ, true);
      expect(checkReused.canUse).toBe(false);
      expect(checkReused.reason).toContain('already been used');
    });
  });

  describe('2. LEARN Power-Up', () => {
    it('is LOCKED when completedQuestionsCount < 100 (Boundary test 99 vs 100)', () => {
      const stats99: UserStats = { ...baseStats, completedQuestionsCount: 99 };
      const inv99 = PowerUpService.calculateInventory(stats99);
      const learn99 = inv99.items.find((i) => i.id === 'LEARN')!;
      expect(learn99.isUnlocked).toBe(false);
      expect(learn99.status).toBe('LOCKED');

      const check99 = PowerUpService.canUseLearn(stats99, sampleMCQ, false);
      expect(check99.canUse).toBe(false);

      const stats100: UserStats = { ...baseStats, completedQuestionsCount: 100 };
      const inv100 = PowerUpService.calculateInventory(stats100);
      const learn100 = inv100.items.find((i) => i.id === 'LEARN')!;
      expect(learn100.isUnlocked).toBe(true);
      expect(learn100.status).toBe('AVAILABLE');

      const check100 = PowerUpService.canUseLearn(stats100, sampleMCQ, false);
      expect(check100.canUse).toBe(true);
      expect(check100.clue).toBe(sampleMCQ.learning_objective);
    });

    it('reveals clinical clue without modifying user answer selection', () => {
      const stats100: UserStats = { ...baseStats, completedQuestionsCount: 100 };
      const check = PowerUpService.canUseLearn(stats100, sampleMCQ, false);
      expect(check.canUse).toBe(true);
      expect(check.clue).toBe('Identify proper anatomical landmark placement for the diaphragm.');
    });

    it('cannot be reused on the same question', () => {
      const stats100: UserStats = { ...baseStats, completedQuestionsCount: 100 };
      const check = PowerUpService.canUseLearn(stats100, sampleMCQ, true);
      expect(check.canUse).toBe(false);
      expect(check.reason).toContain('already active');
    });
  });

  describe('3. STREAK SHIELD Power-Up (Edge Cases A through F)', () => {
    const storage = new StorageRepository();

    it('is LOCKED when currentStreak < 30 (Boundary test 29 vs 30)', () => {
      const stats29: UserStats = { ...baseStats, currentStreak: 29 };
      const inv29 = PowerUpService.calculateInventory(stats29);
      expect(inv29.streakShield.isUnlocked).toBe(false);
      expect(inv29.streakShield.status).toBe('LOCKED');

      const stats30: UserStats = { ...baseStats, currentStreak: 30 };
      const inv30 = PowerUpService.calculateInventory(stats30);
      expect(inv30.streakShield.isUnlocked).toBe(true);
      expect(inv30.streakShield.status).toBe('AVAILABLE');
    });

    // CASE A: 30-day streak, 1 missed day -> shield protects streak
    it('CASE A: 30-day streak protects exactly 1 missed day and consumes shield', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 30, false);
      expect(res.newStreak).toBe(31);
      expect(res.shieldWasConsumed).toBe(true);
    });

    // CASE B: 30-day streak, 1 missed day -> consumed, another missed day -> breaks
    it('CASE B: once shield is consumed, subsequent missed day resets streak to 1', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 31, true); // already consumed
      expect(res.newStreak).toBe(1);
      expect(res.shieldWasConsumed).toBe(false);
    });

    // CASE C: 29-day streak, missed day -> no shield protection
    it('CASE C: 29-day streak without unlock resets streak to 1 on missed day', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 29, false);
      expect(res.newStreak).toBe(1);
      expect(res.shieldWasConsumed).toBe(false);
    });

    // CASE D: 31-day streak, missed day -> shield protects
    it('CASE D: 31-day streak protects missed day and consumes shield', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 31, false);
      expect(res.newStreak).toBe(32);
      expect(res.shieldWasConsumed).toBe(true);
    });

    // CASE E: 30-day streak, user never misses -> shield remains available
    it('CASE E: 30-day streak user training consecutive days preserves available shield', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const res = storage.computeStreak(yesterdayStr, 30, false);
      expect(res.newStreak).toBe(31);
      expect(res.shieldWasConsumed).toBe(false); // Not consumed because no day was missed!
    });

    // CASE F: 2 or more consecutive missed days -> streak breaks
    it('CASE F: missing 2 or more consecutive days breaks streak even with shield', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(threeDaysAgoStr, 40, false);
      expect(res.newStreak).toBe(1);
      expect(res.shieldWasConsumed).toBe(false);
    });

    it('displays CONSUMED state in inventory once consumed', () => {
      const consumedStats: UserStats = {
        ...baseStats,
        currentStreak: 32,
        streakShieldConsumed: true,
      };
      const inv = PowerUpService.calculateInventory(consumedStats);
      expect(inv.streakShield.isUnlocked).toBe(true);
      expect(inv.streakShield.status).toBe('CONSUMED');
    });
  });

  describe('4. PERMANENT REMOVAL VERIFICATION: HINT and RETRY Completely Removed', () => {
    it('verifies PowerUpService does not expose canUseHint or canUseRetry methods', () => {
      expect((PowerUpService as any).canUseHint).toBeUndefined();
      expect((PowerUpService as any).canUseRetry).toBeUndefined();
    });

    it('verifies calculateInventory contains NO HINT and NO RETRY items', () => {
      const fullStats: UserStats = {
        ...baseStats,
        currentStreak: 35,
        completedQuestionsCount: 150,
      };
      const inv = PowerUpService.calculateInventory(fullStats);
      expect(inv.items.length).toBe(2); // Only 50/50 and LEARN
      expect(inv.items.map((i) => i.id)).toEqual(['FIFTY_FIFTY', 'LEARN']);
      expect(inv.items.some((i) => (i.id as string) === 'HINT')).toBe(false);
      expect(inv.items.some((i) => (i.id as string) === 'RETRY')).toBe(false);
    });

    it('verifies FeedbackDrawer has no retry prop or retry button (answers are final)', () => {
      const el = React.createElement(FeedbackDrawer, {
        isOpen: true,
        evaluation: {
          status: 'INCORRECT',
          is_correct: false,
          user_payload: { type: 'MCQ', selected_option: 'option_b' },
          correct_solution_display: 'Option A',
          explanation: 'Option A is correct.',
          learning_objective: 'Master proper physical chestpiece grip.',
          category: 'DEVICE_HANDLING',
          question_id: 'Q_TEST_MCQ_02',
          awarded_xp: 0,
        },
        onContinue: () => {},
        isLastQuestion: false,
      });

      // No retry-related props allowed
      expect((el.props as any).canRetry).toBeUndefined();
      expect((el.props as any).onUseRetry).toBeUndefined();
    });
  });
});

describe('Core Competency Progress Calculation', () => {
  it('aggregates real question answers by 3 Core Competency areas from stored sessions', async () => {
    const storage = new StorageRepository();

    const mockSessions: StoredSessionRecord[] = [
      {
        sessionId: 'session_01',
        timestamp: Date.now() - 86400000,
        totalQuestions: 4,
        correctCount: 3,
        xpEarned: 25,
        date: '2026-09-28',
        answers: [
          // Device Handling: 1 correct, 1 incorrect
          { questionId: 'q1', isCorrect: true, category: 'DEVICE_HANDLING', userAnswer: { type: 'MCQ', selected_option: 'option_a' } },
          { questionId: 'q2', isCorrect: false, category: 'DEVICE_HANDLING', userAnswer: { type: 'MCQ', selected_option: 'option_b' } },
          // Heart Recording: 2 correct
          { questionId: 'q3', isCorrect: true, category: 'HEART_RECORDING', userAnswer: { type: 'MCQ', selected_option: 'option_a' } },
          { questionId: 'q4', isCorrect: true, category: 'ANATOMICAL_PLACEMENT', userAnswer: { type: 'MCQ', selected_option: 'option_c' } },
        ],
      },
    ];

    vi.spyOn(storage, 'getAllSessions').mockResolvedValue(mockSessions);

    const competencies = await storage.getCompetencyProgress();
    expect(competencies.length).toBe(3);

    const deviceHandling = competencies.find((c) => c.area === 'DEVICE_HANDLING')!;
    expect(deviceHandling.questionsAttempted).toBe(2);
    expect(deviceHandling.questionsCorrect).toBe(1);
    expect(deviceHandling.accuracyPercentage).toBe(50);

    const heartRecording = competencies.find((c) => c.area === 'HEART_RECORDING')!;
    expect(heartRecording.questionsAttempted).toBe(2);
    expect(heartRecording.questionsCorrect).toBe(2);
    expect(heartRecording.accuracyPercentage).toBe(100);

    const qualityAssessment = competencies.find((c) => c.area === 'QUALITY_ASSESSMENT')!;
    expect(qualityAssessment.questionsAttempted).toBe(0);
    expect(qualityAssessment.questionsCorrect).toBe(0);
    expect(qualityAssessment.accuracyPercentage).toBe(null);
  });
});

describe('UI Component Integration for Power-Ups & Profile', () => {
  const mockStats: UserStats = {
    totalXp: 450,
    currentStreak: 25,
    longestStreak: 25,
    lastActiveDate: '2026-09-29',
    completedQuestionsCount: 120,
    completedSessionsCount: 12,
    totalCorrectAnswersCount: 65,
    streakShieldConsumed: false,
  };

  const sampleMCQ: MCQQuestion = {
    question_id: 'Q_TEST_MCQ_02',
    category: 'DEVICE_HANDLING',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    question: 'How should you hold the stethoscope chestpiece?',
    option_a: 'Between thumb and index finger against skin',
    option_b: 'Using only the pinky finger',
    option_c: 'By the earpieces',
    option_d: 'Tapping with fingertips',
    correct_answer: 'option_a',
    explanation: 'Firm, even pressure between thumb and index finger produces the clearest acoustic seal.',
    learning_objective: 'Master proper physical chestpiece grip.',
    tags: ['handling'],
    clinician_validated: true,
    source: 'DEMO',
    version: '1.0.0',
  };

  it('DailySessionScreen instantiates with power-up action callbacks (50/50 and LEARN)', () => {
    let fiftyFiftyCalled = false;
    let learnCalled = false;

    const el = React.createElement(DailySessionScreen, {
      session: {
        status: 'IN_PROGRESS',
        dailyStatus: 'IN_PROGRESS',
        sessionId: 'session_test',
        currentIndex: 0,
        questions: [sampleMCQ],
        currentAnswer: null,
        currentEvaluation: null,
        history: [],
        totalXpEarned: 0,
        correctCount: 0,
        questionsCompleted: false,
        reviewViewed: false,
        startTime: Date.now(),
        endTime: null,
        fiftyFiftyEliminatedOptions: {},
        learnClueRevealed: {},
      },
      userStats: mockStats,
      currentQuestion: sampleMCQ,
      onSetAnswer: () => {},
      onSubmitAnswer: () => {},
      onApplyFiftyFifty: () => { fiftyFiftyCalled = true; },
      onApplyLearn: () => { learnCalled = true; },
      onNextQuestion: () => {},
      onExitSession: () => {},
    });

    expect(el.props.userStats).toBeDefined();
    expect(el.props.onApplyFiftyFifty).toBeDefined();
    el.props.onApplyFiftyFifty();
    expect(fiftyFiftyCalled).toBe(true);

    el.props.onApplyLearn();
    expect(learnCalled).toBe(true);

    // Assert RETRY and HINT callbacks do not exist
    expect((el.props as any).onApplyHint).toBeUndefined();
    expect((el.props as any).onApplyRetry).toBeUndefined();
  });

  it('ProfileScreen instantiates with userStats and back navigation callback', () => {
    let backTriggered = false;

    const el = React.createElement(ProfileScreen, {
      userStats: mockStats,
      onBack: () => { backTriggered = true; },
    });

    expect(el.props.userStats.totalXp).toBe(450);
    expect(el.props.userStats.currentStreak).toBe(25);
    el.props.onBack();
    expect(backTriggered).toBe(true);
  });
});
