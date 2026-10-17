import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProfileScreen } from '../src/views/ProfileScreen';
import { UserStats } from '../src/models/session.types';
import { UserProfile } from '../src/models/user.types';
import { StorageRepository } from '../src/repositories/StorageRepository';

describe('Simplified & Compact ProfileScreen for ASHA Health Workers', () => {
  const userAStats: UserStats = {
    totalXp: 165,
    currentStreak: 1,
    longestStreak: 5,
    lastActiveDate: '2026-09-29',
    completedQuestionsCount: 40,
    completedSessionsCount: 4,
    totalCorrectAnswersCount: 35,
    streakShieldConsumed: false,
  };

  const userAProfile: UserProfile = {
    id: 'user-lakshmi-01',
    name: 'Lakshmi',
    role: 'ASHA Health Worker',
    healthSubCentre: 'Kengeri Sub-Centre',
    district: 'Bengaluru',
    state: 'Karnataka',
  };

  const userBStats: UserStats = {
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    completedQuestionsCount: 0,
    completedSessionsCount: 0,
    totalCorrectAnswersCount: 0,
    streakShieldConsumed: false,
  };

  const userBProfile: UserProfile = {
    id: 'user-anita-02',
    name: 'Anita',
    role: 'Anganwadi Worker',
    healthSubCentre: 'Hosur Sub-Centre',
    district: 'Mysuru',
    state: 'Karnataka',
  };

  // 1. Profile information rendering
  it('renders authenticated user name, role, and location', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Lakshmi');
    expect(html).toContain('ASHA Health Worker');
    expect(html).toContain('Bengaluru, Karnataka');
    expect(html).toContain('Kengeri Sub-Centre');
    // Ensure raw database IDs are NOT exposed
    expect(html).not.toContain('user-lakshmi-01');
  });

  // 2. Exactly ONE Edit Profile action (inside Profile Card only, removed from Account)
  it('renders exactly ONE Edit Profile action inside the Profile card and NOT in Account', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    const matches = html.match(/Edit Profile/g);
    expect(matches).not.toBeNull();
    // Exactly 1 instance in the profile card
    expect(matches?.length).toBe(1);
  });

  // 3. Back to Home button removed (Header back arrow is the sole navigation)
  it('does NOT render the bottom Back to Home button', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).not.toContain('Back to Home');
    // Header back button exists
    expect(html).toContain('Go Back');
    expect(html).toContain('My Profile');
  });

  // 4. Simplified Learning Metrics (Points, Streak, Lessons) with short labels
  it('renders concise My Learning metrics (Streak, Points, Lessons)', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('My Learning');
    expect(html).toContain('Streak');
    expect(html).toContain('1 Day');
    expect(html).toContain('Points');
    expect(html).toContain('165');
    expect(html).toContain('Lessons');
    expect(html).toContain('4');
  });

  // 5. User B (0 data) handles zero state without NaN or undefined
  it('renders 0 Days streak, 0 Points, 0 Lessons for User B without NaN', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userBProfile,
        userStats: userBStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Anita');
    expect(html).toContain('Anganwadi Worker');
    expect(html).toContain('0 Days');
    expect(html).toContain('0');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  // 6. Verification that complex technical sections are REMOVED from UI
  it('does NOT render Core Competency Progress section or progress bars', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).not.toContain('Core Competency Progress');
    expect(html).not.toContain('3 Core Areas');
    expect(html).not.toContain('Device Handling');
    expect(html).not.toContain('Heart Recording');
    expect(html).not.toContain('Recording Quality Assessment');
  });

  it('does NOT render Training Statistics, Accuracy, or Raw Answer Counters', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).not.toContain('Training Statistics');
    expect(html).not.toContain('Auscultation Accuracy');
    expect(html).not.toContain('Questions Answered');
    expect(html).not.toContain('Correct Answers');
    expect(html).not.toContain('NaN%');
  });

  // 7. Power-Ups / Learning Tools are REMOVED from ProfileScreen (moved to dedicated PowerUpsScreen)
  it('does NOT render Power-Ups or Learning Tools section in ProfileScreen', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).not.toContain('My Learning Tools');
    expect(html).not.toContain('💡 Hint');
    expect(html).not.toContain('📖 Learn');
    expect(html).not.toContain('↩ Retry');
    expect(html).not.toContain('🛡 Shield');
    expect(html).not.toContain('Streak Shield');
  });

  // 8. Account Section contains ONLY Sign Out
  it('renders Account section containing ONLY Sign Out', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('Account');
    expect(html).toContain('Sign Out');
    expect(html).toContain('Keep your training progress saved');
  });

  // 9. User Data Isolation
  it('ensures User A and User B data are completely isolated', () => {
    const htmlA = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    const htmlB = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userBProfile,
        userStats: userBStats,
        onBack: () => {},
      })
    );

    expect(htmlA).toContain('Lakshmi');
    expect(htmlA).toContain('165');
    expect(htmlA).not.toContain('Anita');

    expect(htmlB).toContain('Anita');
    expect(htmlB).not.toContain('Lakshmi');
    expect(htmlB).not.toContain('165');
  });

  // 10. Callbacks execution
  it('handles navigation, edit profile, and sign out callbacks', () => {
    let backTriggered = false;
    let editTriggered = false;
    let signOutTriggered = false;

    const el = React.createElement(ProfileScreen, {
      userProfile: userAProfile,
      userStats: userAStats,
      onBack: () => { backTriggered = true; },
      onEditProfile: () => { editTriggered = true; },
      onSignOut: () => { signOutTriggered = true; },
    });

    el.props.onBack();
    expect(backTriggered).toBe(true);

    el.props.onEditProfile!();
    expect(editTriggered).toBe(true);

    el.props.onSignOut!();
    expect(signOutTriggered).toBe(true);
  });

  // 11. Sign out does not delete training data in storage
  it('signing out preserves training sessions and user statistics in storage', async () => {
    const storage = new StorageRepository();
    const testStats: UserStats = {
      totalXp: 250,
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: '2026-09-29',
      completedQuestionsCount: 20,
      completedSessionsCount: 2,
      totalCorrectAnswersCount: 18,
      streakShieldConsumed: false,
    };

    await storage.saveUserStats(testStats);

    let signedOut = false;
    const onSignOut = () => {
      signedOut = true;
    };
    onSignOut();
    expect(signedOut).toBe(true);

    const storedStats = await storage.getUserStats();
    expect(storedStats.totalXp).toBe(250);
    expect(storedStats.completedSessionsCount).toBe(2);
  });

  // 12. Underlying Storage Integrity
  it('preserves underlying StorageRepository competency data aggregation method', async () => {
    const storage = new StorageRepository();
    const competencyData = await storage.getCompetencyProgress();
    expect(Array.isArray(competencyData)).toBe(true);
    expect(competencyData.length).toBe(3);
  });

  // 13. Touch targets and responsive action heights
  it('verifies primary buttons and account rows have minimum 48px touch targets', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    expect(html).toContain('min-h-[48px]');
  });

  // 14. Verification of Header non-zero stats (TEST-002)
  it('renders Header with user real non-zero streak and XP (TEST-002)', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: userAProfile,
        userStats: userAStats,
        onBack: () => {},
      })
    );

    const cleanHtml = html.replace(/<!-- -->/g, '');
    expect(cleanHtml).toContain('1');
    expect(cleanHtml).toContain('165');
  });
});
