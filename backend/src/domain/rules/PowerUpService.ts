import { UserStats } from '../models/session.model.js';
import { Question } from '../models/question.model.js';

export interface PowerUpItem {
  id: 'FIFTY_FIFTY' | 'LEARN' | 'STREAK_SHIELD';
  name: string;
  tagline: string;
  description: string;
  status: 'LOCKED' | 'AVAILABLE' | 'CONSUMED';
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

export class PowerUpService {
  static calculateInventory(
    stats: UserStats,
    consumedOverrides?: Partial<Record<string, boolean>>
  ): PowerUpInventory {
    const streak = stats.currentStreak || 0;
    const questionsAnswered = stats.completedQuestionsCount || 0;

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
}
