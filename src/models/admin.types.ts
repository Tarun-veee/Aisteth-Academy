export type OnboardingStatus = 'NOT_INITIATED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

export type AccountStatus = 'ACTIVE' | 'DEACTIVATED' | 'PENDING';

export interface AdminOverviewStats {
  totalLearners: number;
  activeLearners: number;
  pendingOnboarding: number;
  failedOnboarding: number;
  deactivatedLearners?: number;
}

export interface LearnerSummaryItem {
  uid: string;
  username: string;
  displayName: string;
  phoneNumber?: string;
  designation: string;
  healthSubCentre?: string;
  district?: string; // Optional legacy field
  state?: string;    // Optional legacy field
  totalXp: number;
  currentStreak: number;
  currentLevel: number;
  completedQuestionsCount: number;
  completedSessionsCount: number;
  onboardingStatus: OnboardingStatus;
  accountStatus: AccountStatus;
  whatsappOnboardedAt?: string | null;
  onboardingError?: string | null;
  createdAt: string;
}

export interface ListLearnersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OnboardingStatus | 'ALL';
  accountStatus?: AccountStatus | 'ALL';
}

export interface UpdateLearnerInput {
  displayName?: string;
  phoneNumber?: string;
  designation?: string;
  healthSubCentre?: string;
  accountStatus?: AccountStatus;
}

export interface ResetCredentialsResult {
  uid: string;
  username: string;
  phoneNumber?: string;
  temporaryPassword: string;
  loginUrl: string;
  instructions: string;
}

export interface ListLearnersResult {
  learners: LearnerSummaryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SingleLearnerInput {
  displayName: string;
  phoneNumber: string;
  username?: string;
  designation: string;
  healthSubCentre?: string;
  optionalEmail?: string;
  password?: string;
}

export interface BulkLearnerRowInput {
  displayName: string;
  phoneNumber: string;
  username?: string;
  designation?: string;
  healthSubCentre?: string;
  district?: string; // Ignored legacy column
  state?: string;    // Ignored legacy column
  optionalEmail?: string;
  password?: string;
}

export interface BulkImportItemResult {
  rowNumber: number;
  displayName: string;
  phoneNumber: string;
  username: string;
  status: 'SUCCESS' | 'SKIPPED_DUPLICATE' | 'FAILED';
  uid?: string;
  error?: string;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: BulkImportItemResult[];
}

export interface WhatsAppOnboardingResult {
  uid: string;
  phoneNumber: string;
  status: OnboardingStatus;
  sentAt?: string;
  messageId?: string;
  error?: string;
}
