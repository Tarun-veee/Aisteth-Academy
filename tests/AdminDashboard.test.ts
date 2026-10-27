import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AdminDashboard } from '../src/views/admin/AdminDashboard';
import { AdminOverview } from '../src/views/admin/AdminOverview';
import { AdminAddLearner } from '../src/views/admin/AdminAddLearner';
import { AdminBulkImport } from '../src/views/admin/AdminBulkImport';
import { ProfileScreen } from '../src/views/ProfileScreen';
import { UserStats } from '../src/models/session.types';
import { UserProfile } from '../src/models/user.types';

describe('Admin Dashboard Component Suite', () => {
  const dummyStats: UserStats = {
    totalXp: 450,
    currentStreak: 7,
    longestStreak: 10,
    lastActiveDate: '2026-10-20',
    completedQuestionsCount: 60,
    completedSessionsCount: 6,
    totalCorrectAnswersCount: 52,
    streakShieldConsumed: false,
  };

  const adminProfile: UserProfile = {
    id: 'admin_user_001',
    name: 'Dr. Admin',
    role: 'ASHA Health Worker',
    systemRole: 'PLATFORM_ADMIN',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
  };

  const traineeProfile: UserProfile = {
    id: 'trainee_user_002',
    name: 'Priya Sharma',
    role: 'ASHA Health Worker',
    systemRole: 'TRAINEE',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
  };

  it('renders AdminDashboard layout with sidebar navigation items and branding', () => {
    const html = renderToString(
      React.createElement(AdminDashboard, {
        onNavigateLearnerView: () => {},
        onSignOut: () => {},
        adminDisplayName: 'Dr. State Admin',
      })
    );

    expect(html).toContain('AiSteth Admin');
    expect(html).toContain('RBSK Learning Engine');
    expect(html).toContain('Overview');
    expect(html).toContain('Learners Directory');
    expect(html).toContain('Add Individual');
    expect(html).toContain('Bulk CSV Import');
    expect(html).toContain('Learner View');
    expect(html).toContain('Dr. State Admin');
  });

  it('renders AdminOverview loading or metric cards structure', () => {
    const html = renderToString(
      React.createElement(AdminOverview, {
        onNavigateTab: () => {},
      })
    );

    expect(html).toContain('Learner Onboarding &amp; Administration');
    expect(html).toContain('RBSK Trainee Learning Engine');
  });

  it('renders AdminAddLearner with mandatory form inputs', () => {
    const html = renderToString(
      React.createElement(AdminAddLearner, {
        onNavigateBack: () => {},
      })
    );

    expect(html).toContain('Register New Learner');
    expect(html).toContain('Full Name');
    expect(html).toContain('Phone Number (WhatsApp)');
    expect(html).toContain('Designation / Role');
    expect(html).toContain('Health Sub Centre / Facility');
    expect(html).toContain('Register Learner');
  });

  it('renders AdminBulkImport with CSV upload zone and column guidance', () => {
    const html = renderToString(
      React.createElement(AdminBulkImport, {
        onNavigateLearnerList: () => {},
      })
    );

    expect(html).toContain('Bulk CSV Learner Import');
    expect(html).toContain('Select or drop a CSV file');
    expect(html).toContain('Sample CSV Template');
    expect(html).toContain('Browse CSV File');
  });

  it('shows Administration entry in ProfileScreen for PLATFORM_ADMIN users', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: adminProfile,
        userStats: dummyStats,
        onBack: () => {},
        onNavigateAdmin: () => {},
      })
    );

    expect(html).toContain('Administration');
    expect(html).toContain('Admin Dashboard');
    expect(html).toContain('Manage learner accounts &amp; WhatsApp onboarding');
  });

  it('hides Administration entry in ProfileScreen for standard TRAINEE users', () => {
    const html = renderToString(
      React.createElement(ProfileScreen, {
        userProfile: traineeProfile,
        userStats: dummyStats,
        onBack: () => {},
        onNavigateAdmin: () => {},
      })
    );

    expect(html).not.toContain('Administration');
    expect(html).not.toContain('Manage learner accounts &amp; WhatsApp onboarding');
  });
});
