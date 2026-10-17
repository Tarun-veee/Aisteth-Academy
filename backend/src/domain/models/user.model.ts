export type UserRole = 'TRAINEE' | 'SUPERVISOR' | 'CONTENT_ADMIN' | 'PLATFORM_ADMIN';

export type Designation =
  | 'ASHA_WORKER'
  | 'ANGANWADI_WORKER'
  | 'HEALTH_VOLUNTEER'
  | 'ASHA'
  | 'ANM'
  | 'CHO'
  | 'RBSK_MO'
  | string;

export interface UserLearningState {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  completedQuestionsCount: number;
  completedSessionsCount: number;
  totalCorrectAnswersCount: number;
  currentLevel?: number;
  streakShieldActive?: boolean;
  streakShieldConsumed?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Designation;
  healthSubCentre?: string;
  centerName?: string;
  district?: string;
  state?: string;
  createdAt?: string;
}

export interface UserProfileDoc {
  uid: string;
  username: string;
  syntheticEmail: string;
  optionalEmail?: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  designation: string;
  healthSubCentre: string;
  district: string;
  state: string;
  trainingTimeZone: string;
  learningState: UserLearningState;
  createdAt: any;
  updatedAt: any;
  lastActiveAt?: any;
}
