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

export class ProgressionService {
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
