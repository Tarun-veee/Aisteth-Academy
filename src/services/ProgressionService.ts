/**
 * AiSteth Academy - Progression Service
 * Deterministic calculation of user levels, XP boundaries, and progress percentages.
 *
 * NOTE: The progression levels and XP threshold curves defined here are PROVISIONAL
 * and subject to final clinical/product curriculum decisions.
 */

import { ProgressionLevel, UserProgression } from '../models/progression.types';

/**
 * PROVISIONAL LEVEL THRESHOLDS (Subject to final product decision)
 */
export const PROVISIONAL_PROGRESSION_LEVELS: ProgressionLevel[] = [
  {
    level: 1,
    title: 'Trainee',
    minXp: 0,
    maxXp: 100,
    description: 'Beginning fundamental clinical auscultation and device handling.',
  },
  {
    level: 2,
    title: 'Apprentice',
    minXp: 100,
    maxXp: 300,
    description: 'Mastering chest landmark placement and basic heart sound recording.',
  },
  {
    level: 3,
    title: 'Practitioner',
    minXp: 300,
    maxXp: 600,
    description: 'Confidently identifying common noise artifacts and standard procedures.',
  },
  {
    level: 4,
    title: 'Specialist',
    minXp: 600,
    maxXp: 1000,
    description: 'Skilled in subtle audio discrimination and artifact troubleshooting.',
  },
  {
    level: 5,
    title: 'Master Auscultator',
    minXp: 1000,
    maxXp: null,
    description: 'Highest clinical competency in digital stethoscope auscultation.',
  },
];

export const PROGRESSION_LEVELS = PROVISIONAL_PROGRESSION_LEVELS;

export const MAX_LEVEL = 31;
export const FOUNDATIONAL_XP_THRESHOLD = 310;
export const XP_PER_MAIN_QUESTION = 10;
export const TOTAL_CURRICULUM_MAIN_QUESTIONS = 310;

export type XpAwardReason =
  | 'AWARDED_UNDER_THRESHOLD'
  | 'THRESHOLD_REACHED_NO_XP'
  | 'ALREADY_COMPLETED_NO_XP'
  | 'INCORRECT_NO_XP'
  | 'FOLLOW_UP_NO_XP';

export interface XpAwardCalculationResult {
  awardedXp: number;
  isNewlyCompleted: boolean;
  reason: XpAwardReason;
  updatedTotalXp: number;
}

export interface CalculateMainQuestionXpParams {
  currentTotalXp: number;
  questionId: string;
  lifetimeCompletedQuestionIds?: string[];
  isCorrect: boolean;
}

export class ProgressionService {
  /**
   * Authoritative check for valid canonical XP:
   * Must be a finite number greater than or equal to zero.
   */
  static isValidXp(xp: unknown): xp is number {
    return typeof xp === 'number' && Number.isFinite(xp) && xp >= 0;
  }

  /**
   * Authoritative Level formula for RBSK Learning Engine Phase 2:
   * level = min(31, floor(max(0, totalXp) / 10) + 1)
   */
  static calculateLevel(totalXp: number): number {
    const validXp = Math.max(0, isNaN(totalXp) ? 0 : totalXp);
    return Math.min(MAX_LEVEL, Math.floor(validXp / XP_PER_MAIN_QUESTION) + 1);
  }

  /**
   * Main question XP award calculation (Decision 2 Option A).
   */
  static calculateMainQuestionXpAward(params: CalculateMainQuestionXpParams): XpAwardCalculationResult {
    const validXp = Math.max(0, isNaN(params.currentTotalXp) ? 0 : params.currentTotalXp);

    if (!params.isCorrect) {
      return {
        awardedXp: 0,
        isNewlyCompleted: false,
        reason: 'INCORRECT_NO_XP',
        updatedTotalXp: validXp,
      };
    }

    const ledger = Array.isArray(params.lifetimeCompletedQuestionIds)
      ? params.lifetimeCompletedQuestionIds
      : [];

    if (ledger.includes(params.questionId)) {
      return {
        awardedXp: 0,
        isNewlyCompleted: false,
        reason: 'ALREADY_COMPLETED_NO_XP',
        updatedTotalXp: validXp,
      };
    }

    if (validXp < FOUNDATIONAL_XP_THRESHOLD) {
      return {
        awardedXp: XP_PER_MAIN_QUESTION,
        isNewlyCompleted: true,
        reason: 'AWARDED_UNDER_THRESHOLD',
        updatedTotalXp: validXp + XP_PER_MAIN_QUESTION,
      };
    }

    return {
      awardedXp: 0,
      isNewlyCompleted: true,
      reason: 'THRESHOLD_REACHED_NO_XP',
      updatedTotalXp: validXp,
    };
  }

  /**
   * Curriculum completion check:
   * Returns true ONLY when all 310 actual foundational Main-question IDs have been completed.
   */
  static isCurriculumCompleted(
    lifetimeCompletedQuestionIds?: string[],
    authoritativeMainQuestionIds?: string[] | readonly string[]
  ): boolean {
    if (!Array.isArray(lifetimeCompletedQuestionIds) || lifetimeCompletedQuestionIds.length === 0) return false;
    const completedSet = new Set(lifetimeCompletedQuestionIds.filter(Boolean));
    if (Array.isArray(authoritativeMainQuestionIds) && authoritativeMainQuestionIds.length > 0) {
      return authoritativeMainQuestionIds.every((id) => completedSet.has(id));
    }
    return completedSet.size >= TOTAL_CURRICULUM_MAIN_QUESTIONS;
  }

  /**
   * Calculates the learner's progression status based on total XP earned.
   * Deterministic, zero-dependency pure function.
   */
  static calculateProgression(totalXp: number): UserProgression {
    const validXp = Math.max(0, isNaN(totalXp) ? 0 : totalXp);

    // Find current level matching XP range
    let currentLevelIndex = PROGRESSION_LEVELS.length - 1;
    for (let i = 0; i < PROGRESSION_LEVELS.length; i++) {
      const lvl = PROGRESSION_LEVELS[i];
      if (lvl.maxXp !== null) {
        if (validXp >= lvl.minXp && validXp < lvl.maxXp) {
          currentLevelIndex = i;
          break;
        }
      } else {
        // Highest level (minXp and above)
        if (validXp >= lvl.minXp) {
          currentLevelIndex = i;
          break;
        }
      }
    }

    const currentLevel = PROGRESSION_LEVELS[currentLevelIndex];
    const isMaxLevel = currentLevel.maxXp === null;
    const nextLevel = isMaxLevel ? null : PROGRESSION_LEVELS[currentLevelIndex + 1];

    if (isMaxLevel) {
      return {
        currentLevel,
        nextLevel: null,
        currentXp: validXp,
        xpInCurrentLevel: validXp - currentLevel.minXp,
        xpRequiredForNextLevel: 0,
        progressPercent: 100,
        isMaxLevel: true,
      };
    }

    const levelMin = currentLevel.minXp;
    const levelMax = currentLevel.maxXp!;
    const levelRange = levelMax - levelMin;
    const xpInCurrentLevel = validXp - levelMin;
    const progressPercent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / levelRange) * 100)));

    return {
      currentLevel,
      nextLevel,
      currentXp: validXp,
      xpInCurrentLevel,
      xpRequiredForNextLevel: levelRange,
      progressPercent,
      isMaxLevel: false,
    };
  }
}
