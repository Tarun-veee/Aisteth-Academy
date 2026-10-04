/**
 * AiSteth Academy — Server Auth & Registration Type Contracts
 * Specification Baseline: v2.6.1-PROD-SPEC
 */

export type UserRole = 'TRAINEE' | 'SUPERVISOR' | 'CONTENT_ADMIN' | 'PLATFORM_ADMIN';

export type Designation = 'ASHA' | 'ANM' | 'CHO' | 'RBSK_MO' | 'SUPERVISOR' | 'OTHER';

export interface RegisterWithUsernameRequest {
  username: string;
  password: string;
  displayName: string;
  designation: Designation;
  district: string;
  state: string;
  healthSubCentre?: string;
  optionalEmail?: string;
}

export interface RegisterWithUsernameResponse {
  success: boolean;
  uid: string;
  username: string;
  syntheticEmail: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  message: string;
}

export type UsernameReservationStatus = 'RESERVED' | 'ACTIVE';

export interface UsernameReservationDoc {
  username: string;
  uid: string | null;
  status: UsernameReservationStatus;
  reservationId: string; // Unique ownership token preventing cross-request compensation race conditions
  reservedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  activatedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
}

export interface UserLearningState {
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  completedSessionsCount: number;
  completedQuestionsCount: number;
  totalCorrectAnswersCount: number;
  streakShieldActive: boolean;
  streakShieldConsumed: boolean;
}

export interface UserProfileDoc {
  uid: string;
  username: string;
  syntheticEmail: string;
  optionalEmail: string;
  displayName: string;
  role: UserRole;
  organizationId: string;
  designation: Designation;
  healthSubCentre: string;
  district: string;
  state: string;
  trainingTimeZone: string;
  learningState: UserLearningState;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  lastActiveAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
}
