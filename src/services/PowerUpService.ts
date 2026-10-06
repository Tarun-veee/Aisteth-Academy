/**
 * AiSteth Academy - Power-Up Service
 * Pure deterministic calculation of Power-Up unlock statuses and in-session interactions.
 * Specification: Frozen Three-Power-Up System.
 *
 * Official Power-Ups and Frozen Unlock Rules:
 * 1. 50/50: Unlocks when currentStreak >= 20 (20-day streak)
 * 2. LEARN: Unlocks when completedQuestionsCount >= 100 (100 questions answered)
 * 3. STREAK SHIELD: Unlocks when currentStreak >= 30 (30-day streak)
 *
 * HINT and RETRY are permanently removed.
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
    const streak = stats.currentStreak || 0;
    const questionsAnswered = stats.completedQuestionsCount || 0;

    // 1. 50/50 Power-Up (Unlock at 20-day streak)
    const fiftyFiftyUnlocked = streak >= 20;
    const fiftyFiftyConsumed = consumedOverrides?.FIFTY_FIFTY ?? false;
    const fiftyFiftyItem: PowerUpItem = {
      id: 'FIFTY_FIFTY',
      name: '50/50',
      tagline: 'Removes 2 incorrect options',
      description: 'Narrows down multiple choice options by eliminating two incorrect choices.',
      status: fiftyFiftyUnlocked ? (fiftyFiftyConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 20,
      unlockCurrent: Math.min(20, streak),
      unlockMetricLabel: 'day streak',
      isUnlocked: fiftyFiftyUnlocked,
    };

    // 2. LEARN Power-Up (Unlock at 100 questions answered)
    const learnUnlocked = questionsAnswered >= 100;
    const learnConsumed = consumedOverrides?.LEARN ?? false;
    const learnItem: PowerUpItem = {
      id: 'LEARN',
      name: 'LEARN',
      tagline: 'Shows the learning objective',
      description: 'Reveals the clinical learning objective associated with the active question.',
      status: learnUnlocked ? (learnConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 100,
      unlockCurrent: Math.min(100, questionsAnswered),
      unlockMetricLabel: 'questions answered',
      isUnlocked: learnUnlocked,
    };

    // 3. STREAK SHIELD Power-Up (Unlock at 30-day streak)
    const shieldUnlocked = streak >= 30;
    const shieldConsumed = (consumedOverrides?.STREAK_SHIELD ?? false) || Boolean(stats.streakShieldConsumed);
    const shieldItem: PowerUpItem = {
      id: 'STREAK_SHIELD',
      name: 'STREAK SHIELD',
      tagline: 'Protects one missed day',
      description: 'Automatically preserves your active streak if you miss one calendar day of training.',
      status: shieldUnlocked ? (shieldConsumed ? 'CONSUMED' : 'AVAILABLE') : 'LOCKED',
      unlockTarget: 30,
      unlockCurrent: Math.min(30, streak),
      unlockMetricLabel: 'day streak',
      isUnlocked: shieldUnlocked,
    };

    const items = [fiftyFiftyItem, learnItem];
    const totalUnlockedCount = (fiftyFiftyItem.isUnlocked ? 1 : 0) + (learnItem.isUnlocked ? 1 : 0) + (shieldItem.isUnlocked ? 1 : 0);

    return {
      items,
      streakShield: shieldItem,
      totalUnlockedCount,
    };
  }

  /**
   * Determines if 50/50 can be activated on the current question.
   * Only supported on MCQ questions.
   */
  static canUseFiftyFifty(
    stats: UserStats,
    question: Question | null,
    isFiftyFiftyAlreadyUsed: boolean
  ): { canUse: boolean; isUnlocked: boolean; isSupported: boolean; reason?: string } {
    const isUnlocked = (stats.currentStreak || 0) >= 20;
    if (!question) {
      return { canUse: false, isUnlocked, isSupported: false, reason: 'No active question' };
    }

    const isSupported = question.type === 'MCQ';
    if (!isUnlocked) {
      return {
        canUse: false,
        isUnlocked: false,
        isSupported,
        reason: `Unlocks at a 20-day streak (${stats.currentStreak || 0}/20)`,
      };
    }

    if (!isSupported) {
      return {
        canUse: false,
        isUnlocked: true,
        isSupported: false,
        reason: '50/50 is only available for Multiple Choice questions',
      };
    }

    if (isFiftyFiftyAlreadyUsed) {
      return {
        canUse: false,
        isUnlocked: true,
        isSupported: true,
        reason: '50/50 has already been used on this question',
      };
    }

    return { canUse: true, isUnlocked: true, isSupported: true };
  }

  /**
   * Generates the eliminated options for an MCQ question.
   * Guarantees the correct answer is NEVER eliminated and eliminates exactly 2 incorrect options.
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
   * Reveals the clinical learning objective without spoiling the direct answer.
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
        reason: `Unlocks after 100 answered questions (${stats.completedQuestionsCount || 0}/100)`,
      };
    }

    if (!question.learning_objective) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'No clinical learning objective available for this question',
      };
    }

    if (isLearnAlreadyUsed) {
      return {
        canUse: false,
        isUnlocked: true,
        reason: 'LEARN objective is already active for this question',
      };
    }

    return {
      canUse: true,
      isUnlocked: true,
      clue: question.learning_objective,
    };
  }
}
