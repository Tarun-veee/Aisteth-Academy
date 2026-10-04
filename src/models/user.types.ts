/**
 * AiSteth Academy - User Profile & Progress Types
 */

import { UserStats } from './session.types';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role:
    | 'ASHA_WORKER'
    | 'ANGANWADI_WORKER'
    | 'HEALTH_VOLUNTEER'
    | 'ASHA Health Worker'
    | 'Anganwadi Worker'
    | 'Health Volunteer'
    | string;
  healthSubCentre?: string;
  centerName?: string;
  district?: string;
  state?: string;
  createdAt?: string;
}

export interface UserProgressData {
  profile: UserProfile;
  stats: UserStats;
}

export const DEFAULT_USER_STATS: UserStats = {
  totalXp: 0,
  currentStreak: 0,
  lastActiveDate: null,
  completedQuestionsCount: 0,
  completedSessionsCount: 0,
  totalCorrectAnswersCount: 0,
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'dev-user-01',
  name: 'Frontline Trainee',
  role: 'ASHA_WORKER',
  centerName: 'Community Health Centre',
  district: 'Demo District',
  state: 'Demo State'
};
