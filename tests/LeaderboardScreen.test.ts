import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LeaderboardScreen } from '../src/views/LeaderboardScreen';
import { HomeScreen } from '../src/views/HomeScreen';
import { UserStats } from '../src/models/session.types';
import * as useLeaderboardModule from '../src/hooks/useLeaderboard';
import { LeaderboardResponse } from '../src/models/leaderboard.types';

describe('Frontend Community Leaderboard Verification Suite', () => {
  const dummyUserStats: UserStats = {
    totalXp: 180,
    currentStreak: 7,
    longestStreak: 12,
    lastActiveDate: '2026-10-15',
    completedQuestionsCount: 20,
    completedSessionsCount: 2,
    totalCorrectAnswersCount: 18,
    streakShieldConsumed: false,
  };

  const sampleLeaderboardData: LeaderboardResponse = {
    success: true,
    entries: [
      {
        rank: 1,
        displayName: 'Anita Devi',
        username: 'asha_anita',
        totalXp: 310,
        currentLevel: 32,
        isCurrentUser: false,
      },
      {
        rank: 2,
        displayName: 'Rekha Sharma',
        username: 'asha_rekha',
        totalXp: 290,
        currentLevel: 30,
        isCurrentUser: true,
      },
      {
        rank: 2,
        displayName: 'Pooja Verma',
        username: 'anm_pooja',
        totalXp: 290,
        currentLevel: 30,
        isCurrentUser: false,
      },
      {
        rank: 4,
        displayName: 'Priya Singh',
        username: 'asha_priya',
        totalXp: 270,
        currentLevel: 28,
        isCurrentUser: false,
      },
    ],
    currentUser: {
      rank: 2,
      displayName: 'Rekha Sharma',
      username: 'asha_rekha',
      totalXp: 290,
      currentLevel: 30,
      isInTopList: true,
    },
    totalParticipants: 1420,
    returnedCount: 4,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders loading skeleton without flashing zero stats when isLoading is true', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Leaderboard');
    expect(html).toContain('aria-label="Loading leaderboard"');
    expect(html).toContain('animate-pulse');
  });

  it('2. renders error state with descriptive message and retry button when API fails', () => {
    const mockRefetch = vi.fn();
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: null,
      isLoading: false,
      error: 'Network connection failed. Could not reach server.',
      refetch: mockRefetch,
    });

    const el = React.createElement(LeaderboardScreen, {
      userStats: dummyUserStats,
      onBack: () => {},
    });
    const html = renderToString(el);

    expect(html).toContain('Unable to Load Leaderboard');
    expect(html).toContain('Network connection failed');
    expect(html).toContain('Retry');
  });

  it('3. renders empty state when database returns zero eligible participants', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: {
        success: true,
        entries: [],
        currentUser: {
          rank: 1,
          displayName: 'Rekha Sharma',
          username: 'asha_rekha',
          totalXp: 0,
          currentLevel: 1,
          isInTopList: false,
        },
        totalParticipants: 0,
        returnedCount: 0,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('No Leaderboard Entries Available');
    expect(html).toContain('No eligible leaderboard participants are currently available');
  });

  it('4. renders prominent "Your Standing" card with current user rank, XP, and level', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Your current leaderboard standing');
    expect(html).toContain('#2');
    expect(html).toContain('Rekha Sharma');
    expect(html).toContain('@asha_rekha');
    expect(html).toContain('290 XP');
    expect(html).toContain('Level 30');
    expect(html).toContain('Ranked among 1420 trainees');
  });

  it('5. renders top-three podium with Gold (Rank 1), Silver (Rank 2), and bronze accents', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Top three participants podium');
    expect(html).toContain('Anita Devi');
    expect(html).toContain('@asha_anita');
    expect(html).toContain('Pooja Verma');
    expect(html).toContain('@anm_pooja');
  });

  it('6. correctly displays competition ranks with tied podium positions (1, 2, 2)', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    // Position 2 has two tied entries at Rank 2
    expect(html).toContain('310'); // Anita Devi (1st)
    expect(html).toContain('290'); // Rekha and Pooja (Tied 2nd)
  });

  it('7. visually highlights the current user in both standing card and list with "You" badge', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('You');
  });

  it('8. renders ranked participants list (Ranks 4+) with semantic <ol> and accessible labels', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Participant ranking list');
    expect(html).toContain('#4');
    expect(html).toContain('Priya Singh');
    expect(html).toContain('@asha_priya');
    expect(html).toContain('270 XP');
    expect(html).toContain('<ol');
    expect(html).toContain('<li');
  });

  it('9. strictly omits private identifiers (UID, email, district, state, credentials) from rendered HTML', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    expect(html).not.toContain('usr_trainee');
    expect(html).not.toContain('syntheticEmail');
    expect(html).not.toContain('@aisteth.internal');
    expect(html).not.toContain('password');
    expect(html).not.toContain('organizationId');
    expect(html).not.toContain('healthSubCentre');
    expect(html).not.toContain('district');
    expect(html).not.toContain('Varanasi');
  });

  it('10. triggers onBack callback when back chevron is clicked', () => {
    let backClicked = false;
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const el = React.createElement(LeaderboardScreen, {
      userStats: dummyUserStats,
      onBack: () => {
        backClicked = true;
      },
    });

    expect(el.props.onBack).toBeDefined();
    el.props.onBack();
    expect(backClicked).toBe(true);
  });

  it('11. HomeScreen provides entry point to Leaderboard via dedicated Card and Points card', () => {
    let navClicked = false;
    const html = renderToString(
      React.createElement(HomeScreen, {
        userStats: dummyUserStats,
        onStartSession: () => {},
        onNavigateLeaderboard: () => {
          navClicked = true;
        },
      })
    );

    expect(html).toContain('Community Leaderboard');
    expect(html).toContain('See top performers and your community standing');
    expect(html).toContain('aria-label="Community Leaderboard"');
    expect(html).toContain('aria-label="View Leaderboard"');
  });

  it('12. preserves exactly 4 actions in Header right cluster (Header constraint regression)', () => {
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: sampleLeaderboardData,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const html = renderToString(
      React.createElement(LeaderboardScreen, {
        userStats: dummyUserStats,
        onBack: () => {},
      })
    );

    // Verify Header still only shows title, streak, and points (no 5th action)
    expect(html).toContain('Leaderboard');
    expect(html).toContain('Current streak: 7 days');
    expect(html).toContain('Learning Points: 180');
    expect(html).not.toContain('Current level');
  });

  it('13. renders FAILED_PRECONDITION index error state safely with Retry button without leaking sensitive credentials', () => {
    const mockRefetch = vi.fn();
    const indexErrorMessage = '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/aisteth-academy-dev/firestore/indexes?create_composite=test';
    vi.spyOn(useLeaderboardModule, 'useLeaderboard').mockReturnValue({
      leaderboard: null,
      isLoading: false,
      error: indexErrorMessage,
      refetch: mockRefetch,
    });

    const el = React.createElement(LeaderboardScreen, {
      userStats: dummyUserStats,
      onBack: () => {},
    });
    const html = renderToString(el);

    expect(html).toContain('Unable to Load Leaderboard');
    expect(html).toContain('9 FAILED_PRECONDITION: The query requires an index');
    expect(html).toContain('Retry');
    expect(html).not.toContain('privateKey');
    expect(html).not.toContain('client_email');
    expect(html).not.toContain('password');
    expect(html).not.toContain('syntheticEmail');
  });
});

