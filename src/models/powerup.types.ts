/**
 * AiSteth Academy - Power-Up Domain Models
 * Strict TypeScript types for the Frozen Three-Power-Up System.
 *
 * Final Power-Ups (Specification FROZEN):
 * 1. 50/50 (Unlocks at 20-day streak) - Removes 2 incorrect options
 * 2. LEARN (Unlocks at 100 questions answered) - Shows the learning objective
 * 3. STREAK SHIELD (Unlocks at 30-day streak) - Protects one missed day
 */

export type PowerUpType = 'FIFTY_FIFTY' | 'LEARN' | 'STREAK_SHIELD';

export type PowerUpStatus = 'LOCKED' | 'AVAILABLE' | 'CONSUMED';

export interface PowerUpItem {
  id: PowerUpType;
  name: string; // Official names: '50/50', 'LEARN', 'STREAK SHIELD'
  tagline: string;
  description: string;
  status: PowerUpStatus;
  unlockTarget: number;
  unlockCurrent: number;
  unlockMetricLabel: string;
  isUnlocked: boolean;
}

export interface PowerUpInventory {
  items: PowerUpItem[]; // [50/50, LEARN]
  streakShield: PowerUpItem; // STREAK SHIELD
  totalUnlockedCount: number;
}
