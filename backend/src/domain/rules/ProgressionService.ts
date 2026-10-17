import { AUTHORITATIVE_MAIN_QUESTION_IDS } from './sessionSelection.js';

export interface ProgressionLevel {
  level: number;
  title: string;
  minXp: number;
  maxXp: number | null;
  description: string;
}

export interface UserProgression {
  currentLevel: ProgressionLevel;
  nextLevel: ProgressionLevel | null;
  currentXp: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  progressPercent: number;
  isMaxLevel: boolean;
}

export const PROGRESSION_LEVELS: ProgressionLevel[] = [
  { level: 1, title: 'Trainee', minXp: 0, maxXp: 100, description: 'Beginning fundamental clinical auscultation and device handling.' },
  { level: 2, title: 'Apprentice', minXp: 100, maxXp: 300, description: 'Mastering chest landmark placement and basic heart sound recording.' },
  { level: 3, title: 'Practitioner', minXp: 300, maxXp: 600, description: 'Confidently identifying common noise artifacts and standard procedures.' },
  { level: 4, title: 'Specialist', minXp: 600, maxXp: 1000, description: 'Skilled in subtle audio discrimination and artifact troubleshooting.' },
  { level: 5, title: 'Master Auscultator', minXp: 1000, maxXp: null, description: 'Highest clinical competency in digital stethoscope auscultation.' },
];

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
   * Authoritative XP award calculation for Main (Primary) questions.
   * - Follows Decision 2 (Option A):
   *   - Awards 10 XP if previously uncompleted AND currentTotalXp < 310 (even on valid re-attempt).
   *   - Trainee at 305 XP receives 10 XP, reaching 315 XP.
   *   - If currentTotalXp >= 310, awards 0 XP (milestone reached, no XP inflation).
   *   - If question is already in ledger, awards 0 XP.
   *   - Existing historical XP is NEVER reduced.
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

    // Question is uncompleted and answer is correct
    if (validXp < FOUNDATIONAL_XP_THRESHOLD) {
      return {
        awardedXp: XP_PER_MAIN_QUESTION,
        isNewlyCompleted: true,
        reason: 'AWARDED_UNDER_THRESHOLD',
        updatedTotalXp: validXp + XP_PER_MAIN_QUESTION,
      };
    }

    // Trainee already at or above 310 XP
    return {
      awardedXp: 0,
      isNewlyCompleted: true,
      reason: 'THRESHOLD_REACHED_NO_XP',
      updatedTotalXp: validXp,
    };
  }

  /**
   * Follow-up questions always award 0 XP (remedial learning only).
   */
  static calculateFollowUpXpAward(): number {
    return 0;
  }

  /**
   * Session finalization awards 0 XP in Phase 2 (bonus deprecated).
   */
  static calculateSessionFinalizationXpAward(): number {
    return 0;
  }

  /**
   * Curriculum completion milestone:
   * Returns true ONLY when all 310 actual foundational Main-question IDs from the curriculum
   * have been completed.
   *
   * Validates against the authoritative Main-question ID set.
   * If authoritativeMainQuestionIds is provided, validates that every single ID in that set is completed.
   * If not provided, validates against the canonical 310 AUTHORITATIVE_MAIN_QUESTION_IDS.
   * An arbitrary set of 310 IDs that does not match the curriculum will return FALSE.
   */
  static isCurriculumCompleted(
    lifetimeCompletedQuestionIds?: string[],
    authoritativeMainQuestionIds: string[] | readonly string[] = AUTHORITATIVE_MAIN_QUESTION_IDS
  ): boolean {
    if (!Array.isArray(lifetimeCompletedQuestionIds) || lifetimeCompletedQuestionIds.length === 0) {
      return false;
    }
    const completedSet = new Set(lifetimeCompletedQuestionIds.filter(Boolean));
    if (!authoritativeMainQuestionIds || authoritativeMainQuestionIds.length === 0) {
      return false;
    }
    return authoritativeMainQuestionIds.every((id) => completedSet.has(id));
  }

  /**
   * Backward-compatible progression curve calculation for legacy views/tests.
   */
  static calculateProgression(totalXp: number): UserProgression {
    const validXp = Math.max(0, isNaN(totalXp) ? 0 : totalXp);

    let currentLevelIndex = PROGRESSION_LEVELS.length - 1;
    for (let i = 0; i < PROGRESSION_LEVELS.length; i++) {
      const lvl = PROGRESSION_LEVELS[i];
      if (lvl.maxXp !== null) {
        if (validXp >= lvl.minXp && validXp < lvl.maxXp) {
          currentLevelIndex = i;
          break;
        }
      } else {
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
