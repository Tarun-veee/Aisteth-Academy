/**
 * AiSteth Academy - Power-Up Domain Models
 * Strict TypeScript types for Power-Ups and Streak Shield status.
 *
 * Official Power-Ups:
 * 1. HINT (Unlocks at 50 correct answers)
 * 2. LEARN (Unlocks at 100 questions answered)
 * 3. RETRY (Unlocks at 20-day streak)
 * 4. STREAK SHIELD (Unlocks at 30-day streak)
 */

export type PowerUpType = 'HINT' | 'LEARN' | 'RETRY' | 'STREAK_SHIELD';

export type PowerUpStatus = 'LOCKED' | 'AVAILABLE' | 'CONSUMED';

export interface PowerUpItem {
  id: PowerUpType;
  name: string; // Official names: 'HINT', 'LEARN', 'RETRY', 'STREAK SHIELD'
  tagline: string;
  description: string;
  status: PowerUpStatus;
  unlockTarget: number;
  unlockCurrent: number;
  unlockMetricLabel: string;
  isUnlocked: boolean;
}

export interface PowerUpInventory {
  items: PowerUpItem[];
  streakShield: PowerUpItem;
  totalUnlockedCount: number;
}
