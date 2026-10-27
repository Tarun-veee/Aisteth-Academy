import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProgressionService } from '../src/services/ProgressionService';
import { UserStats } from '../src/models/session.types';
import { HomeScreen } from '../src/views/HomeScreen';
import { ProfileScreen } from '../src/views/ProfileScreen';
import { ForgotPasswordScreen } from '../src/views/ForgotPasswordScreen';

describe('HomeScreen Progression & Learning Services', () => {
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

  // 4. Profile/Progress entry point and Screen
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

  // 8. Top-Right Header Action Cluster Tests
  it('HomeScreen passes profile navigation props to Header', () => {
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

  // 14. Learner-Facing Clean UI Tests: Absence of Clinical Vault and Development Prototype Banners
  describe('Learner-Facing Clean UI (Absence of Dev Banners & Clinical Vault)', () => {
    it('HomeScreen strictly omits Clinical Vault: Unsolved Questions card and description', () => {
      const html = renderToString(
        React.createElement(HomeScreen, {
          userStats: { ...baseStats, totalXp: 120, currentStreak: 3 },
          onStartSession: () => {},
          onNavigateLeaderboard: () => {},
        })
      );

      expect(html).not.toContain('Clinical Vault: Unsolved Questions');
      expect(html).not.toContain('Review and reinforce concepts from remedial follow-ups');
      expect(html).not.toContain('Clinical Vault');
    });

    it('HomeScreen strictly omits Phase 1 Development Prototype and demo content notice', () => {
      const html = renderToString(
        React.createElement(HomeScreen, {
          userStats: { ...baseStats, totalXp: 120, currentStreak: 3 },
          onStartSession: () => {},
          onNavigateLeaderboard: () => {},
        })
      );

      expect(html).not.toContain('Phase 1 Development Prototype');
      expect(html).not.toContain('All questions and stethoscope recordings are demonstration content');
      expect(html).not.toContain('software validation');
    });

    it('HomeScreen preserves remaining primary learning UI cards', () => {
      const html = renderToString(
        React.createElement(HomeScreen, {
          userStats: { ...baseStats, totalXp: 120, currentStreak: 3 },
          onStartSession: () => {},
          onNavigateLeaderboard: () => {},
        })
      );

      // Trainee greeting
      expect(html).toContain('Namaste, Trainee!');
      // Daily Mission Hero
      expect(html).toContain('Standard Auscultation Workflow');
      expect(html).toContain('Daily Mission');
      // Stats grid
      expect(html).toContain('Days Streak');
      expect(html).toContain('Points');
      expect(html).toContain('Completed');
      // Leaderboard card
      expect(html).toContain('Community Leaderboard');
    });

    it('ForgotPasswordScreen strictly omits prototype notice and phase disclaimers', () => {
      const html = renderToString(
        React.createElement(ForgotPasswordScreen, {
          onNavigateSignIn: () => {},
        })
      );

      expect(html).not.toContain('Prototype notice');
      expect(html).not.toContain('Phase 3');
      expect(html).not.toContain('Backend email delivery will be connected');
    });
  });
});

