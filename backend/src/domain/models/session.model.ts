export type DailySessionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'QUESTIONS_COMPLETED'
  | 'REVIEW_COMPLETED'
  | 'REVIEW_VIEWED';

export type BranchState = 'MAIN' | 'FOLLOW_UP' | 'REATTEMPT_MAIN';

export interface DailySessionDoc {
  sessionId: string;
  uid: string;
  userId: string;
  localDate: string;
  contentReleaseId: string;
  status: DailySessionStatus;
  questionIds: string[];
  currentQuestionIndex: number;
  questionsCompleted: boolean;
  reviewViewed: boolean;
  totalXpEarned: number;
  correctCount: number;
  accuracy: number;
  branchState?: BranchState;
  activeMainQuestionId?: string;
  activeFollowUpQuestionId?: string | null;
  isReattempt?: boolean;
  selectedTopics?: string[];
  rotatedQuestionIndices?: number[];
  startedAt?: any;
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
}

export interface AttemptDoc {
  attemptId: string;
  dailySessionId: string;
  uid: string;
  userId: string;
  questionId: string;
  contentReleaseId: string;
  questionIndex: number;
  userAnswerPayload: Record<string, any>;
  result: 'CORRECT' | 'INCORRECT';
  xpAwarded: number;
  isFollowUp?: boolean;
  isReattempt?: boolean;
  parentQuestionId?: string | null;
  clientTimestamp: number;
  createdAt?: any;
  serverTimestamp?: any;
}

export interface UserStats {
  totalXp: number;
  currentStreak: number;
  longestStreak?: number;
  lastActiveDate: string | null;
  completedQuestionsCount: number;
  completedSessionsCount: number;
  totalCorrectAnswersCount: number;
}

export interface SubmissionReceiptDoc {
  idempotencyKey: string;
  sessionId: string;
  uid: string;
  questionIndex: number;
  branchState: BranchState;
  questionId: string;
  payloadFingerprint: string;
  fingerprintVersion?: 'v1' | 'v2';
  attemptId: string;
  result: 'CORRECT' | 'INCORRECT';
  xpAwarded: number;
  isSessionComplete: boolean;
  sessionStatus: DailySessionStatus;
  questionsCompleted: boolean;
  currentQuestionIndex: number;
  totalXpEarnedInSession: number;
  correctCount: number;
  createdAt: any;
}

export interface RecordAttemptResponse {
  attemptId: string;
  questionIndex: number;
  branchState: BranchState;
  result: 'CORRECT' | 'INCORRECT';
  xpAwarded: number;
  isSessionComplete: boolean;
  status: DailySessionStatus;
  questionsCompleted: boolean;
  currentQuestionIndex: number;
  totalXpEarned: number;
  correctCount: number;
}

export interface ParsedIdempotencyKey {
  sessionId: string;
  questionIndex: number;
  branchState: BranchState;
  nonce: string;
}

export interface UnsolvedQuestionDoc {
  id: string; // activePrimaryId
  mainQuestionId: string;
  followUpQuestionId: string;
  topic?: string;
  difficultyRank?: number;
  failCount: number;
  initialReason: 'FOLLOW_UP_FAILED' | 'REATTEMPT_FAILED';
  lastFailedReason: 'FOLLOW_UP_FAILED' | 'REATTEMPT_FAILED';
  firstFailedSessionId: string;
  lastFailedSessionId: string;
  isResolved: boolean;
  reviewStatus: 'UNREVIEWED' | 'IN_REVIEW' | 'REVIEWED' | 'BOOKMARKED';
  reviewedAt?: string | null;
  reviewNotes?: string;
  createdAt: any;
  updatedAt: any;
  firstFailedAt: any;
  lastFailedAt: any;
}

