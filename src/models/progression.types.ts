/**
 * AiSteth Academy - Progression Domain Models
 * Strict TypeScript types for learner levels and XP thresholds.
 */

import { QuestionCategory } from './question.types';

export interface ProgressionLevel {
  level: number;
  title: string;
  minXp: number;
  maxXp: number | null; // null for highest level
  description: string;
}

export interface UserProgression {
  currentLevel: ProgressionLevel;
  nextLevel: ProgressionLevel | null;
  currentXp: number;
  xpInCurrentLevel: number;
  xpRequiredForNextLevel: number;
  progressPercent: number; // 0 to 100
  isMaxLevel: boolean;
}

export type CoreCompetencyArea =
  | 'DEVICE_HANDLING'
  | 'HEART_RECORDING'
  | 'QUALITY_ASSESSMENT';

export interface CompetencyProgress {
  area: CoreCompetencyArea;
  title: string;
  description: string;
  categories: QuestionCategory[];
  questionsAttempted: number;
  questionsCorrect: number;
  accuracyPercentage: number | null; // null if 0 attempted ("No data yet")
}

export const CORE_COMPETENCIES: Record<
  CoreCompetencyArea,
  { title: string; description: string; categories: QuestionCategory[] }
> = {
  DEVICE_HANDLING: {
    title: 'Device Handling',
    description: 'Physical operation, hygiene, charging, and preparation of the AiSteth digital stethoscope.',
    categories: ['DEVICE_HANDLING'],
  },
  HEART_RECORDING: {
    title: 'Heart Recording',
    description: 'Auscultation technique, anatomical chest placement, and operating procedures.',
    categories: ['HEART_RECORDING', 'OPERATING_PROCEDURE', 'ANATOMICAL_PLACEMENT'],
  },
  QUALITY_ASSESSMENT: {
    title: 'Recording Quality Assessment',
    description: 'Acoustic signal clarity, ambient noise identification, and artifact troubleshooting.',
    categories: ['QUALITY_ASSESSMENT'],
  },
};

