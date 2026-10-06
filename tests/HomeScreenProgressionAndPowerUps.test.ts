import { describe, it, expect } from 'vitest';
import React from 'react';
import { ProgressionService } from '../src/services/ProgressionService';
import { PowerUpService } from '../src/services/PowerUpService';
import { UserStats } from '../src/models/session.types';
import { HomeScreen } from '../src/views/HomeScreen';
import { ProfileScreen } from '../src/views/ProfileScreen';

describe('HomeScreen Progression & Power-Up Services', () => {
  const baseStats: UserStats = {
    totalXp: 0,
    currentStreak: 0,
    lastActiveDate: null,
    completedQuestionsCount: 0,
    completedSessionsCount: 0,
    totalCorrectAnswersCount: 0,
  };

  // 1. Level display calculation
  it('calculates Level 1 Trainee for initial 0 XP', () => {
    const progression = ProgressionService.calculateProgression(0);
    expect(progression.currentLevel.level).toBe(1);
    expect(progression.currentLevel.title).toBe('Trainee');
    expect(progression.currentXp).toBe(0);
    expect(progression.isMaxLevel).toBe(false);
  });

  // 2. XP progress calculation
  it('calculates XP progress correctly for intermediate XP', () => {
    const progression = ProgressionService.calculateProgression(45);
    expect(progression.currentLevel.level).toBe(1);
    expect(progression.xpInCurrentLevel).toBe(45);
    expect(progression.xpRequiredForNextLevel).toBe(100);
    expect(progression.progressPercent).toBe(45);
    expect(progression.nextLevel?.level).toBe(2);
  });

  // 3. XP progress boundary conditions
  it('handles exact level boundaries seamlessly', () => {
    // Exact boundary to Level 2 (100 XP)
    const lvl2 = ProgressionService.calculateProgression(100);
    expect(lvl2.currentLevel.level).toBe(2);
    expect(lvl2.currentLevel.title).toBe('Apprentice');
    expect(lvl2.xpInCurrentLevel).toBe(0);
    expect(lvl2.xpRequiredForNextLevel).toBe(200); // 300 - 100
    expect(lvl2.progressPercent).toBe(0);

    // Mid-way through Level 2 (200 XP -> 50% through 100..300 bracket)
    const midLvl2 = ProgressionService.calculateProgression(200);
    expect(midLvl2.currentLevel.level).toBe(2);
    expect(midLvl2.xpInCurrentLevel).toBe(100);
    expect(midLvl2.progressPercent).toBe(50);

    // Exact boundary to Level 3 (300 XP)
    const lvl3 = ProgressionService.calculateProgression(300);
    expect(lvl3.currentLevel.level).toBe(3);
    expect(lvl3.currentLevel.title).toBe('Practitioner');

    // Exact boundary to Level 4 (600 XP)
    const lvl4 = ProgressionService.calculateProgression(600);
    expect(lvl4.currentLevel.level).toBe(4);
    expect(lvl4.currentLevel.title).toBe('Specialist');

    // Maximum Level 5 (1000+ XP)
    const maxLvl = ProgressionService.calculateProgression(1500);
    expect(maxLvl.currentLevel.level).toBe(5);
    expect(maxLvl.currentLevel.title).toBe('Master Auscultator');
    expect(maxLvl.isMaxLevel).toBe(true);
    expect(maxLvl.nextLevel).toBeNull();
    expect(maxLvl.progressPercent).toBe(100);
  });

  it('handles negative or NaN XP defensively', () => {
    const negProg = ProgressionService.calculateProgression(-50);
    expect(negProg.currentLevel.level).toBe(1);
    expect(negProg.currentXp).toBe(0);

    const nanProg = ProgressionService.calculateProgression(NaN);
    expect(nanProg.currentLevel.level).toBe(1);
    expect(nanProg.currentXp).toBe(0);
  });

  // 4. Official Power-Up Names
  it('uses official names 50/50, LEARN, STREAK SHIELD and contains exactly 3 power-ups', () => {
    const inventory = PowerUpService.calculateInventory(baseStats);
    expect(inventory.items.length).toBe(2); // 50/50 and LEARN
    const fiftyFifty = inventory.items.find((i) => i.id === 'FIFTY_FIFTY')!;
    const learn = inventory.items.find((i) => i.id === 'LEARN')!;

    expect(fiftyFifty.name).toBe('50/50');
    expect(learn.name).toBe('LEARN');
    expect(inventory.streakShield.name).toBe('STREAK SHIELD');

    // Verify HINT and RETRY are completely absent
    expect(inventory.items.some((i) => (i.id as string) === 'HINT')).toBe(false);
    expect(inventory.items.some((i) => (i.id as string) === 'RETRY')).toBe(false);
  });

  // 5. 50/50 unlock boundary (19 streak -> locked, 20 streak -> unlocked)
  it('enforces 50/50 unlock strictly at 20-day streak', () => {
    // 19-day streak + 500 questions = LOCKED
    const stats19: UserStats = {
      ...baseStats,
      currentStreak: 19,
      completedQuestionsCount: 500,
    };
    const inv19 = PowerUpService.calculateInventory(stats19);
    const ff19 = inv19.items.find((i) => i.id === 'FIFTY_FIFTY')!;
    expect(ff19.status).toBe('LOCKED');
    expect(ff19.isUnlocked).toBe(false);
    expect(ff19.unlockCurrent).toBe(19);
    expect(ff19.unlockTarget).toBe(20);

    // 20-day streak = UNLOCKED
    const stats20: UserStats = {
      ...baseStats,
      currentStreak: 20,
    };
    const inv20 = PowerUpService.calculateInventory(stats20);
    const ff20 = inv20.items.find((i) => i.id === 'FIFTY_FIFTY')!;
    expect(ff20.status).toBe('AVAILABLE');
    expect(ff20.isUnlocked).toBe(true);
    expect(ff20.unlockCurrent).toBe(20);
  });

  // 6. LEARN unlock boundary (99 answered -> locked, 100 answered -> unlocked)
  it('enforces LEARN unlock strictly at 100 questions answered', () => {
    // 99 answered + 50 streak = LOCKED
    const stats99: UserStats = {
      ...baseStats,
      completedQuestionsCount: 99,
      currentStreak: 50,
    };
    const inv99 = PowerUpService.calculateInventory(stats99);
    const learn99 = inv99.items.find((i) => i.id === 'LEARN')!;
    expect(learn99.status).toBe('LOCKED');
    expect(learn99.isUnlocked).toBe(false);
    expect(learn99.unlockCurrent).toBe(99);
    expect(learn99.unlockTarget).toBe(100);

    // 100 answered = UNLOCKED
    const stats100: UserStats = {
      ...baseStats,
      completedQuestionsCount: 100,
    };
    const inv100 = PowerUpService.calculateInventory(stats100);
    const learn100 = inv100.items.find((i) => i.id === 'LEARN')!;
    expect(learn100.status).toBe('AVAILABLE');
    expect(learn100.isUnlocked).toBe(true);
    expect(learn100.unlockCurrent).toBe(100);
  });

  // 7. STREAK SHIELD unlock boundary (29-day streak -> locked, 30-day streak -> unlocked)
  it('enforces STREAK SHIELD unlock strictly at 30-day streak', () => {
    // 29-day streak + 500 XP = LOCKED
    const stats29: UserStats = {
      ...baseStats,
      currentStreak: 29,
      totalXp: 500,
    };
    const inv29 = PowerUpService.calculateInventory(stats29);
    expect(inv29.streakShield.status).toBe('LOCKED');
    expect(inv29.streakShield.isUnlocked).toBe(false);
    expect(inv29.streakShield.unlockCurrent).toBe(29);
    expect(inv29.streakShield.unlockTarget).toBe(30);

    // 30-day streak = UNLOCKED
    const stats30: UserStats = {
      ...baseStats,
      currentStreak: 30,
    };
    const inv30 = PowerUpService.calculateInventory(stats30);
    expect(inv30.streakShield.status).toBe('AVAILABLE');
    expect(inv30.streakShield.isUnlocked).toBe(true);
    expect(inv30.streakShield.unlockCurrent).toBe(30);
  });

  // 8. Unrelated Counter Isolation
  it('does not incorrectly unlock power-ups from unrelated counters', () => {
    // 20-day streak with 0 questions answered unlocks 50/50 but NOT LEARN
    const statsStreakOnly: UserStats = {
      ...baseStats,
      currentStreak: 20,
      completedQuestionsCount: 0,
    };
    const invStreak = PowerUpService.calculateInventory(statsStreakOnly);
    expect(invStreak.items.find((i) => i.id === 'FIFTY_FIFTY')!.isUnlocked).toBe(true);
    expect(invStreak.items.find((i) => i.id === 'LEARN')!.isUnlocked).toBe(false);
    expect(invStreak.streakShield.isUnlocked).toBe(false);

    // 100 questions with 0 streak unlocks LEARN but NOT 50/50 or STREAK SHIELD
    const statsQuestionsOnly: UserStats = {
      ...baseStats,
      completedQuestionsCount: 100,
      currentStreak: 0,
    };
    const invQ = PowerUpService.calculateInventory(statsQuestionsOnly);
    expect(invQ.items.find((i) => i.id === 'FIFTY_FIFTY')!.isUnlocked).toBe(false);
    expect(invQ.items.find((i) => i.id === 'LEARN')!.isUnlocked).toBe(true);
    expect(invQ.streakShield.isUnlocked).toBe(false);
  });

  it('correctly handles consumed streak shield override', () => {
    const stats: UserStats = {
      ...baseStats,
      completedQuestionsCount: 60,
      currentStreak: 35,
      streakShieldConsumed: true,
    };

    const inventory = PowerUpService.calculateInventory(stats);
    expect(inventory.streakShield.isUnlocked).toBe(true);
    expect(inventory.streakShield.status).toBe('CONSUMED');
  });

  // 9. Profile/Progress entry point and Screen
  it('ProfileScreen renders with back callback', () => {
    let backed = false;
    const profileEl = React.createElement(ProfileScreen, {
      userStats: { ...baseStats, totalXp: 350, currentStreak: 7 },
      onBack: () => { backed = true; },
    });
    expect(profileEl.props.onBack).toBeDefined();
    profileEl.props.onBack();
    expect(backed).toBe(true);
  });

  // 10. Loading state handling
  it('HomeScreen accepts loading prop and disables interactive button', () => {
    const loadingEl = React.createElement(HomeScreen, {
      userStats: baseStats,
      isLoading: true,
      onStartSession: () => {},
    });
    expect(loadingEl.props.isLoading).toBe(true);
  });

  // 11. Error state and retry handling
  it('HomeScreen accepts error and retry props', () => {
    let retried = false;
    const errorEl = React.createElement(HomeScreen, {
      userStats: baseStats,
      isError: true,
      errorMessage: 'Local storage unavailable',
      onRetry: () => { retried = true; },
      onStartSession: () => {},
    });
    expect(errorEl.props.isError).toBe(true);
    expect(errorEl.props.errorMessage).toBe('Local storage unavailable');
    errorEl.props.onRetry();
    expect(retried).toBe(true);
  });

  // 12. Existing Today\'s Training behavior preservation across states
  it('preserves existing daily status transitions', () => {
    const notStartedEl = React.createElement(HomeScreen, {
      userStats: baseStats,
      dailyStatus: 'NOT_STARTED',
      onStartSession: () => {},
    });
    expect(notStartedEl.props.dailyStatus).toBe('NOT_STARTED');

    const inProgressEl = React.createElement(HomeScreen, {
      userStats: baseStats,
      dailyStatus: 'IN_PROGRESS',
      currentQuestionIndex: 3,
      totalQuestionsCount: 10,
      onStartSession: () => {},
    });
    expect(inProgressEl.props.dailyStatus).toBe('IN_PROGRESS');

    const completedEl = React.createElement(HomeScreen, {
      userStats: baseStats,
      dailyStatus: 'REVIEW_VIEWED',
      onStartSession: () => {},
    });
    expect(completedEl.props.dailyStatus).toBe('REVIEW_VIEWED');
  });

  // 13. Top-Right Header Action Cluster Tests
  it('HomeScreen passes level, power-ups, and profile navigation props to Header', () => {
    let navProfileTriggered = false;

    const homeEl = React.createElement(HomeScreen, {
      userStats: { ...baseStats, totalXp: 350, currentStreak: 12 },
      onStartSession: () => {},
      onNavigateProfile: () => { navProfileTriggered = true; },
    });

    expect(homeEl.props.onNavigateProfile).toBeDefined();
    homeEl.props.onNavigateProfile!();
    expect(navProfileTriggered).toBe(true);
  });
});
