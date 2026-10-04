/**
 * AiSteth Academy - Power-Up Service
 * Pure deterministic calculation of Power-Up unlock statuses, in-session interactions, and Streak Shield protection.
 *
 * Official Power-Ups and Unlock Rules:
 * 1. HINT: Unlocks when totalCorrectAnswersCount >= 50 (50 correct answers)
 * 2. LEARN: Unlocks when completedQuestionsCount >= 100 (100 questions answered)
 * 3. RETRY: Unlocks when currentStreak >= 20 (20-day streak)
 * 4. STREAK SHIELD: Unlocks when currentStreak >= 30 (30-day streak)
 */

import { UserStats } from '../models/session.types';
import { PowerUpItem, PowerUpInventory } from '../models/powerup.types';
import { Question, MCQQuestion } from '../models/question.types';

export class PowerUpService {
  /**
   * Calculates the learner's Power-Up availability and inventory based on real UserStats.
   * Pure, deterministic function without invented quantities or artificial recharge timers.
   */
  static calculateInventory(
    stats: UserStats,
    consumedOverrides?: Partial<Record<string, boolean>>
  ): PowerUpInventory {
    const correctAnswers = stats.totalCorrectAnswersCount || 0;
    const questionsAnswered = stats.completedQuestionsCount || 0;
    const streak = stats.currentStreak || 0;

    // 1. HINT Power-Up (Unlock at 50 correct answers)
    const hintUnlocked = correctAnswers >= 50;
    const hintConsumed = consumedOverrides?.HINT ?? false;
    const hintItem: PowerUpItem = {
      id: 'HINT',
      name: 'HINT',
      tagline: 'Eliminates 2 incorrect options',
      description: 'Narrows down multiple choice options to increase clinical diagnostic accuracy.',
      status: hintUnlocked ? (hintConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 50,
      unlockCurrent: Math.min(50, correctAnswers),
      unlockMetricLabel: 'correct answers',
      isUnlocked: hintUnlocked,
    };

    // 2. LEARN Power-Up (Unlock at 100 questions answered)
    const learnUnlocked = questionsAnswered >= 100;
    const learnConsumed = consumedOverrides?.LEARN ?? false;
    const learnItem: PowerUpItem = {
      id: 'LEARN',
      name: 'LEARN',
      tagline: 'Reveals clinical learning clue',
      description: 'Provides a non-spoiler clinical diagnostic clue before submitting an answer.',
      status: learnUnlocked ? (learnConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 100,
      unlockCurrent: Math.min(100, questionsAnswered),
      unlockMetricLabel: 'questions answered',
      isUnlocked: learnUnlocked,
    };

    // 3. RETRY Power-Up (Unlock at 20-day streak)
    const retryUnlocked = streak >= 20;
    const retryConsumed = consumedOverrides?.RETRY ?? false;
    const retryItem: PowerUpItem = {
      id: 'RETRY',
      name: 'RETRY',
      tagline: 'Re-attempt 1 question',
      description: 'Allows a second attempt on a missed question without breaking performance flow.',
      status: retryUnlocked ? (retryConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 20,
      unlockCurrent: Math.min(20, streak),
      unlockMetricLabel: 'day streak',
      isUnlocked: retryUnlocked,
    };

    // 4. STREAK SHIELD Power-Up (Unlock at 30-day streak)
    const shieldUnlocked = streak >= 30;
    const shieldConsumed = (consumedOverrides?.STREAK_SHIELD ?? false) || Boolean(stats.streakShieldConsumed);
    const shieldItem: PowerUpItem = {
      id: 'STREAK_SHIELD',
      name: 'STREAK SHIELD',
      tagline: 'Protects 1 missed day',
      description: 'Automatically preserves your active streak if you miss one calendar day of training.',
      status: shieldUnlocked ? (shieldConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 30,
      unlockCurrent: Math.min(30, streak),
      unlockMetricLabel: 'day streak',
      isUnlocked: shieldUnlocked,
    };

    const items = [hintItem, learnItem, retryItem];
    const totalUnlockedCount = items.filter((i) => i.isUnlocked).length + (shieldItem.isUnlocked ? 1 : 0);

    return {
      items,
      streakShield: shieldItem,
      totalUnlockedCount,
    };
  }

  /**
   * Determines if HINT can be activated on the current question.
   * Only supported on MCQ questions.
   */
  static canUseHint(
    stats: UserStats,
    question: Question | null,
    isHintAlreadyUsed: boolean
  ): { canUse: boolean; isUnlocked: boolean; isSupported: boolean; reason?: string } {
    const isUnlocked = (stats.totalCorrectAnswersCount || 0) >= 50;
    if (!question) {
      return { canUse: false, isUnlocked, isSupported: false, reason: 'No active question' };
    }

    const isSupported = question.type === 'MCQ';
    if (!isUnlocked) {
      return {
        canUse: false,
        isUnlocked: false,
        isSupported,
        reason: `Unlocks at 50 correct answers (${stats.totalCorrectAnswersCount || 0}/50)`,
      };
    }

    if (!isSupported) {
      return {
        canUse: false,
        isUnlocked: true,
        isSupported: false,
        reason: 'HINT is only available for Multiple Choice questions',
      };
    }

    if (isHintAlreadyUsed) {
      return {
        canUse: false,
        isUnlocked: true,
        isSupported: true,
        reason: 'HINT has already been used on this question',
      };
    }

    return { canUse: true, isUnlocked: true, isSupported: true };
  }

  /**
   * Generates the eliminated options for an MCQ question.
   * Guarantees the correct answer is NEVER eliminated and eliminates 2 incorrect options.
   */
  static getEliminatedOptions(
    question: MCQQuestion
  ): ('option_a' | 'option_b' | 'option_c' | 'option_d')[] {
    const allOptions: ('option_a' | 'option_b' | 'option_c' | 'option_d')[] = [
      'option_a',
      'option_b',
      'option_c',
      'option_d',
    ];

    // Filter out the correct answer so it is strictly protected
    const incorrectOptions = allOptions.filter((opt) => opt !== question.correct_answer);

    // Deterministically eliminate the first 2 incorrect options
    return incorrectOptions.slice(0, 2);
  }

  /**
   * Determines if LEARN can be activated on the current question.
   * Reveals a clinical clue without spoiling the direct answer.
   */
  static canUseLearn(
    stats: UserStats,
    question: Question | null,
    isLearnAlreadyUsed: boolean
  ): { canUse: boolean; isUnlocked: boolean; clue?: string; reason?: string } {
    const isUnlocked = (stats.completedQuestionsCount || 0) >= 100;
    if (!question) {
      return { canUse: false, isUnlocked, reason: 'No active question' };
    }

    if (!isUnlocked) {
      return {
        canUse: false,
        isUnlocked: false,
        reason: `Unlocks at 100 questions answered (${stats.completedQuestionsCount || 0}/100)`,
      };
    }

    if (!question.learning_objective) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'No clinical clue available for this question',
      };
    }

    if (isLearnAlreadyUsed) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'LEARN clue is already active for this question',
      };
    }

    return {
      canUse: true,
      isUnlocked: true,
      clue: question.learning_objective,
    };
  }

  /**
   * Determines if RETRY can be activated after an incorrect answer submission.
   */
  static canUseRetry(
    stats: UserStats,
    isSubmitted: boolean,
    isCorrect: boolean,
    isRetryAlreadyUsed: boolean
  ): { canUse: boolean; isUnlocked: boolean; reason?: string } {
    const isUnlocked = (stats.currentStreak || 0) >= 20;

    if (!isUnlocked) {
      return {
        canUse: false,
        isUnlocked: false,
        reason: `Unlocks at 20-day streak (${stats.currentStreak || 0}/20)`,
      };
    }

    if (!isSubmitted) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'RETRY becomes available after an incorrect answer submission',
      };
    }

    if (isCorrect) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'Question was answered correctly; RETRY not needed',
      };
    }

    if (isRetryAlreadyUsed) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'RETRY has already been used once on this question',
      };
    }

    return { canUse: true, isUnlocked: true };
  }
}
