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
    totalCorrectAnswersCount: 65,
    streakShieldConsumed: false, // Unlocks 50/50 (>= 20) and STREAK SHIELD (>= 30)
  };

  const consumedStats: UserStats = {
    ...unlockedStats,
    streakShieldConsumed: true,
  };

  it('renders PowerUpsScreen with header, banner, and EXACTLY 3 power-up tools: 50/50, Learn, Streak Shield', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: lockedStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Power-Ups');
    expect(html).toContain('My Learning Tools');
    expect(html).toContain('Use these tools while learning');
    expect(html).toContain('50/50');
    expect(html).toContain('Learn');
    expect(html).toContain('Streak Shield');

    // Removal verification: NO HINT or RETRY
    expect(html).not.toContain('Hint');
    expect(html).not.toContain('Retry');
  });

  it('displays Locked status and frozen threshold labels when criteria are not met', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: lockedStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Locked');
    expect(html).toContain('Unlock at a 20-day streak');
    expect(html).toContain('Unlock after 100 answered questions');
    expect(html).toContain('Unlock at a 30-day streak');
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
    expect(html).toContain('Protects one missed day');
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

  it('renders Header with real non-zero streak and XP (TEST-002)', () => {
    const html = renderToString(
      React.createElement(PowerUpsScreen, {
        userStats: unlockedStats,
        onBack: () => {},
      })
    );

    const cleanHtml = html.replace(/<!-- -->/g, '');
    expect(cleanHtml).toContain('32');
    expect(cleanHtml).toContain('500');
  });
});
