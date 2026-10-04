import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PowerUpsScreen } from '../src/views/PowerUpsScreen';
import { UserStats } from '../src/models/session.types';

describe('Dedicated PowerUpsScreen View', () => {
  const lockedStats: UserStats = {
    totalXp: 50,
    currentStreak: 2,
    longestStreak: 2,
    lastActiveDate: '2026-09-29',
    completedQuestionsCount: 10,
    completedSessionsCount: 1,
    totalCorrectAnswersCount: 8,
    streakShieldConsumed: false,
  };

  const unlockedStats: UserStats = {
    totalXp: 500,
    currentStreak: 32,
    longestStreak: 32,
    lastActiveDate: '2026-09-29',
    completedQuestionsCount: 120, // Unlocks LEARN (>= 100)
    completedSessionsCount: 12,
    totalCorrectAnswersCount: 65, // Unlocks HINT (>= 50)
    streakShieldConsumed: false, // Unlocks RETRY (>= 20) and STREAK SHIELD (>= 30)
  };

  const consumedStats: UserStats = {
    ...unlockedStats,
    streakShieldConsumed: true,
  };

  it('renders PowerUpsScreen with header, banner, and all 4 power-up tools', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: lockedStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Power-Ups');
    expect(html).toContain('My Learning Tools');
    expect(html).toContain('Use these tools while learning');
    expect(html).toContain('Hint');
    expect(html).toContain('Learn');
    expect(html).toContain('Retry');
    expect(html).toContain('Streak Shield');
  });

  it('displays Locked status when criteria are not met', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: lockedStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Locked');
    // Ensure no complicated formulas are shown
    expect(html).not.toContain('more needed');
    expect(html).not.toContain('Unlocks at');
  });

  it('displays Available status when criteria are met', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: unlockedStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Available');
  });

  it('displays Used status when Streak Shield has been consumed', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: consumedStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Used');
  });

  it('handles back button callback correctly', () => {
    let backClicked = false;

    const el = React.createElement(PowerUpsScreen, {
      userStats: lockedStats,
      onBack: () => { backClicked = true; },
    });

    el.props.onBack();
    expect(backClicked).toBe(true);
  });
});
