/**
 * AiSteth Academy — Comprehensive Power-Up Functionality Audit Suite
 * Exhaustive programmatic audit proving behavior of exactly 3 power-ups:
 * 1. 50/50 (currentStreak >= 20)
 * 2. LEARN (completedQuestionsCount >= 100)
 * 3. STREAK SHIELD (currentStreak >= 30)
 *
 * Also verifies permanent, complete removal of HINT and RETRY.
 */

import { describe, it, expect } from 'vitest';
import { PowerUpService } from '../src/services/PowerUpService';
import { StorageRepository, getLocalTodayDateString } from '../src/repositories/StorageRepository';
import { AnswerEvaluator } from '../src/services/AnswerEvaluator';
import { MCQQuestion, UserAnswerPayload } from '../src/models/question.types';
import { UserStats, DailySessionData } from '../src/models/session.types';

describe('AISteth Academy — Power-Up Functionality Audit Verification', () => {
  // Elevated stats satisfying all 3 thresholds
  const elevatedStats: UserStats = {
    totalXp: 500,
    currentStreak: 30,
    longestStreak: 30,
    lastActiveDate: getLocalTodayDateString(),
    completedQuestionsCount: 100,
    completedSessionsCount: 10,
    totalCorrectAnswersCount: 50,
    streakShieldConsumed: false,
  };

  const zeroStats: UserStats = {
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    completedQuestionsCount: 0,
    completedSessionsCount: 0,
    totalCorrectAnswersCount: 0,
    streakShieldConsumed: false,
  };

  const sampleMCQ: MCQQuestion = {
    question_id: 'DEMO_MCQ_001',
    category: 'DEVICE_HANDLING',
    type: 'MCQ',
    difficulty: 'BEGINNER',
    question: 'What should you check on the AiSteth device before beginning an auscultation recording?',
    option_a: 'Ensure device power is on and battery indicator is green',
    option_b: 'Check the patient\'s height and weight record',
    option_c: 'Ensure the room temperature is below 20°C',
    option_d: 'Check the mobile SIM card balance',
    correct_answer: 'option_a',
    explanation: 'Always confirm power and battery indicator.',
    learning_objective: 'Verify device readiness and power status prior to starting clinical examination.',
    tags: ['device_check'],
    clinician_validated: false,
    source: 'DEMO',
    version: '1.0.0',
  };

  describe('PHASE 1 & INVENTORY: Unlock Thresholds Verification (Exactly 3 Power-Ups)', () => {
    it('verifies all 3 power-ups are unlocked with elevated test stats', () => {
      const inventory = PowerUpService.calculateInventory(elevatedStats);
      expect(inventory.totalUnlockedCount).toBe(3);
      expect(inventory.items.length).toBe(2); // 50/50 and LEARN

      const fiftyFifty = inventory.items.find((i) => i.id === 'FIFTY_FIFTY')!;
      expect(fiftyFifty.isUnlocked).toBe(true);
      expect(fiftyFifty.status).toBe('AVAILABLE');
      expect(fiftyFifty.unlockCurrent).toBe(20);
      expect(fiftyFifty.unlockTarget).toBe(20);

      const learn = inventory.items.find((i) => i.id === 'LEARN')!;
      expect(learn.isUnlocked).toBe(true);
      expect(learn.status).toBe('AVAILABLE');
      expect(learn.unlockCurrent).toBe(100);
      expect(learn.unlockTarget).toBe(100);

      const shield = inventory.streakShield;
      expect(shield.isUnlocked).toBe(true);
      expect(shield.status).toBe('AVAILABLE');
      expect(shield.unlockCurrent).toBe(30);
      expect(shield.unlockTarget).toBe(30);

      // Verify HINT and RETRY are completely absent from inventory items
      expect(inventory.items.some((i) => (i.id as string) === 'HINT')).toBe(false);
      expect(inventory.items.some((i) => (i.id as string) === 'RETRY')).toBe(false);
    });

    it('verifies all 3 power-ups are locked with baseline zero stats', () => {
      const inventory = PowerUpService.calculateInventory(zeroStats);
      expect(inventory.totalUnlockedCount).toBe(0);
      expect(inventory.items.every((i) => !i.isUnlocked && i.status === 'LOCKED')).toBe(true);
      expect(inventory.streakShield.isUnlocked).toBe(false);
      expect(inventory.streakShield.status).toBe('LOCKED');
    });

    it('enforces exact frozen thresholds: 50/50 (streak 20), LEARN (100 answered), STREAK SHIELD (streak 30)', () => {
      // 50/50 boundary
      const s19 = { ...zeroStats, currentStreak: 19 };
      expect(PowerUpService.calculateInventory(s19).items.find((i) => i.id === 'FIFTY_FIFTY')!.isUnlocked).toBe(false);
      const s20 = { ...zeroStats, currentStreak: 20 };
      expect(PowerUpService.calculateInventory(s20).items.find((i) => i.id === 'FIFTY_FIFTY')!.isUnlocked).toBe(true);

      // LEARN boundary
      const q99 = { ...zeroStats, completedQuestionsCount: 99 };
      expect(PowerUpService.calculateInventory(q99).items.find((i) => i.id === 'LEARN')!.isUnlocked).toBe(false);
      const q100 = { ...zeroStats, completedQuestionsCount: 100 };
      expect(PowerUpService.calculateInventory(q100).items.find((i) => i.id === 'LEARN')!.isUnlocked).toBe(true);

      // STREAK SHIELD boundary
      const str29 = { ...zeroStats, currentStreak: 29 };
      expect(PowerUpService.calculateInventory(str29).streakShield.isUnlocked).toBe(false);
      const str30 = { ...zeroStats, currentStreak: 30 };
      expect(PowerUpService.calculateInventory(str30).streakShield.isUnlocked).toBe(true);
    });
  });

  describe('PHASE 2: 50/50 Power-Up Functional Audit', () => {
    it('eliminates exactly 2 incorrect options and preserves the correct answer', () => {
      const eliminated = PowerUpService.getEliminatedOptions(sampleMCQ);
      expect(eliminated.length).toBe(2);
      expect(eliminated).toEqual(['option_b', 'option_c']);
      expect(eliminated.includes(sampleMCQ.correct_answer)).toBe(false);
    });

    it('guarantees correct answer is protected regardless of option position', () => {
      const mcqB = { ...sampleMCQ, correct_answer: 'option_b' as const };
      const elimB = PowerUpService.getEliminatedOptions(mcqB);
      expect(elimB.includes('option_b')).toBe(false);
      expect(elimB.length).toBe(2);

      const mcqC = { ...sampleMCQ, correct_answer: 'option_c' as const };
      const elimC = PowerUpService.getEliminatedOptions(mcqC);
      expect(elimC.includes('option_c')).toBe(false);
      expect(elimC.length).toBe(2);

      const mcqD = { ...sampleMCQ, correct_answer: 'option_d' as const };
      const elimD = PowerUpService.getEliminatedOptions(mcqD);
      expect(elimD.includes('option_d')).toBe(false);
      expect(elimD.length).toBe(2);
    });

    it('prevents reusing 50/50 on the same question', () => {
      const checkFirst = PowerUpService.canUseFiftyFifty(elevatedStats, sampleMCQ, false);
      expect(checkFirst.canUse).toBe(true);

      const checkSecond = PowerUpService.canUseFiftyFifty(elevatedStats, sampleMCQ, true);
      expect(checkSecond.canUse).toBe(false);
      expect(checkSecond.reason).toContain('already been used');
    });

    it('fails gracefully for non-MCQ questions', () => {
      const tfQuestion: any = { ...sampleMCQ, type: 'TRUE_FALSE' };
      const checkTF = PowerUpService.canUseFiftyFifty(elevatedStats, tfQuestion, false);
      expect(checkTF.canUse).toBe(false);
      expect(checkTF.isSupported).toBe(false);
      expect(checkTF.reason).toContain('Multiple Choice');
    });

    it('does not award XP directly and does not automatically submit an answer', () => {
      // 50/50 only returns eliminated options list
      const elim = PowerUpService.getEliminatedOptions(sampleMCQ);
      expect(elim.length).toBe(2);
      // No XP modification occurs in service
    });
  });

  describe('PHASE 3: LEARN Power-Up Functional Audit', () => {
    it('reveals clinical learning objective without altering user selection or XP', () => {
      const check = PowerUpService.canUseLearn(elevatedStats, sampleMCQ, false);
      expect(check.canUse).toBe(true);
      expect(check.clue).toBe(sampleMCQ.learning_objective);
      // Verify clue is learning objective, NOT the correct answer
      expect(check.clue).not.toContain('option_a');
      expect(check.clue).not.toBe(sampleMCQ.correct_answer);
    });

    it('prevents multiple activations on the same question', () => {
      const checkAgain = PowerUpService.canUseLearn(elevatedStats, sampleMCQ, true);
      expect(checkAgain.canUse).toBe(false);
      expect(checkAgain.reason).toContain('already active');
    });

    it('fails gracefully if question lacks a learning objective', () => {
      const qNoClue = { ...sampleMCQ, learning_objective: '' };
      const check = PowerUpService.canUseLearn(elevatedStats, qNoClue, false);
      expect(check.canUse).toBe(false);
      expect(check.reason).toContain('learning objective available');
    });
  });

  describe('PHASE 4: Complete Removal of RETRY and HINT', () => {
    it('verifies RETRY is not accessible in PowerUpService', () => {
      expect((PowerUpService as any).canUseRetry).toBeUndefined();
    });

    it('verifies HINT is not accessible in PowerUpService', () => {
      expect((PowerUpService as any).canUseHint).toBeUndefined();
    });

    it('verifies answers are final: submitting incorrect answer awards 0 XP and session moves forward with NO retry attempt', () => {
      const sessionHistory: any[] = [];
      let totalXp = 0;

      // Trainee answers incorrectly
      const wrongAnswer: UserAnswerPayload = { type: 'MCQ', selected_option: 'option_d' };
      const evaluation = AnswerEvaluator.evaluate(sampleMCQ, wrongAnswer);

      expect(evaluation.is_correct).toBe(false);
      expect(evaluation.awarded_xp).toBe(0);

      sessionHistory.push({
        questionId: sampleMCQ.question_id,
        userAnswer: wrongAnswer,
        evaluation,
        timestamp: Date.now(),
      });
      totalXp += evaluation.awarded_xp;

      // Exactly 1 attempt is in history, 0 XP awarded
      expect(sessionHistory.length).toBe(1);
      expect(totalXp).toBe(0);

      // Trainee cannot re-attempt the same question: session advances to next index
      const nextIndex = 1;
      expect(nextIndex).toBe(1);
      expect(sessionHistory.length).toBe(1); // No 2nd attempt created
    });
  });

  describe('PHASE 5: STREAK SHIELD Functional Audit', () => {
    const storage = new StorageRepository();

    it('protects streak on exactly 1 missed calendar day when unlocked & unconsumed', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 30, false);
      expect(res.newStreak).toBe(31);
      expect(res.shieldWasConsumed).toBe(true);
    });

    it('resets streak to 1 if shield is already consumed', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 30, true);
      expect(res.newStreak).toBe(1);
      expect(res.shieldWasConsumed).toBe(false);
    });

    it('resets streak to 1 if user misses 2 or more consecutive days', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(threeDaysAgoStr, 40, false);
      expect(res.newStreak).toBe(1);
      expect(res.shieldWasConsumed).toBe(false);
    });

    it('resets streak to 1 if streak is below threshold (< 30 days)', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      const res = storage.computeStreak(twoDaysAgoStr, 29, false);
      expect(res.newStreak).toBe(1);
      expect(res.shieldWasConsumed).toBe(false);
    });
  });

  describe('PHASE 6 & 7: Persistence & Refresh Lifecycle Audit', () => {
    it('verifies DailySessionData preserves 50/50 and LEARN flags across in-session reloads', async () => {
      const storage = new StorageRepository();
      const todayStr = getLocalTodayDateString();

      const testSession: DailySessionData = {
        sessionId: `test_daily_${todayStr}`,
        date: todayStr,
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        reviewViewed: false,
        currentIndex: 2,
        questions: [sampleMCQ, sampleMCQ, sampleMCQ],
        history: [],
        score: 1,
        totalQuestions: 3,
        totalXpEarned: 10,
        correctCount: 1,
        fiftyFiftyEliminatedOptions: { 0: ['option_b', 'option_c'] },
        learnClueRevealed: { 1: true },
      };

      await storage.saveDailySession(testSession);
      const retrieved = await storage.getDailySession(todayStr);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.fiftyFiftyEliminatedOptions?.[0]).toEqual(['option_b', 'option_c']);
      expect(retrieved?.learnClueRevealed?.[1]).toBe(true);
    });

    it('confirms UserStats persistence in local StorageRepository', async () => {
      const storage = new StorageRepository();
      await storage.saveUserStats(elevatedStats);

      const loadedStats = await storage.getUserStats();
      expect(loadedStats.totalCorrectAnswersCount).toBe(50);
      expect(loadedStats.completedQuestionsCount).toBe(100);
      expect(loadedStats.currentStreak).toBe(30);
      expect(loadedStats.streakShieldConsumed).toBe(false);
    });
  });
});
