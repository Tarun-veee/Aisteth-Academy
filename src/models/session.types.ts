/**
 * AiSteth Academy - Session & User Domain Models
 */

import { Question, UserAnswerPayload, AnswerEvaluationResult, QuestionCategory } from './question.types';

export type SessionStatus = 'IDLE' | 'IN_PROGRESS' | 'ANSWER_SUBMITTED' | 'COMPLETED';

export type DailyProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'QUESTIONS_COMPLETED'
  | 'REVIEW_COMPLETED'
  | 'REVIEW_VIEWED'
  | 'COMPLETED';

export interface AnswerRecord {
  questionId: string;
  question: Question;
  userAnswer: UserAnswerPayload | null;
  evaluation: AnswerEvaluationResult;
  timestamp: number;
}

export type BranchState = 'MAIN' | 'FOLLOW_UP' | 'REATTEMPT_MAIN';

export interface DailySessionData {
  sessionId: string;
  date: string; // YYYY-MM-DD local calendar date
  status: DailyProgressStatus;
  questionsCompleted: boolean;
  reviewViewed: boolean;
  currentIndex: number;
  questions: Question[];
  history: AnswerRecord[];
  score: number;
  totalQuestions: number;
  totalXpEarned: number;
  correctCount: number;
  branchState?: BranchState;
  activeMainQuestionId?: string;
  activeFollowUpQuestionId?: string | null;
  isReattempt?: boolean;
}

export interface SessionState {
  status: SessionStatus;
  dailyStatus: DailyProgressStatus;
  sessionId: string;
  currentIndex: number;
  questions: Question[];
  currentAnswer: UserAnswerPayload | null;
  currentEvaluation: AnswerEvaluationResult | null;
  history: AnswerRecord[];
  totalXpEarned: number;
  correctCount: number;
  questionsCompleted: boolean;
  reviewViewed: boolean;
  branchState?: BranchState;
  activeMainQuestionId?: string;
  activeFollowUpQuestionId?: string | null;
  activeFollowUpQuestion?: Question | null;
  isReattempt?: boolean;
  isSubmitting?: boolean;
  pendingIdempotencyKey?: string | null;
  submissionError?: string | null;
  serverPendingTransition?: {
    branchState: BranchState;
    currentQuestionIndex: number;
    isSessionComplete: boolean;
    totalXpEarned: number;
    correctCount: number;
  } | null;
  startTime: number | null;
  endTime: number | null;
}

export interface StoredSessionRecord {
  sessionId: string;
  timestamp: number;
  totalQuestions: number;
  correctCount: number;
  xpEarned: number;
  date?: string;
  answers: {
    questionId: string;
    isCorrect: boolean;
    userAnswer: UserAnswerPayload;
    category?: QuestionCategory;
  }[];
}

export interface UserStats {
  totalXp: number;
  currentStreak: number;
  longestStreak?: number;
  lastActiveDate: string | null; // ISO YYYY-MM-DD
  completedQuestionsCount: number;
  completedSessionsCount: number;
  totalCorrectAnswersCount: number; // Cumulative correct answers
}

export const SESSION_CONFIG = {
  DEFAULT_SESSION_LENGTH: 10,
  XP_REWARDS: {
    PRIMARY_CORRECT: 10,
    FOLLOW_UP_CORRECT: 0,
    MCQ_CORRECT: 5,
    TRUE_FALSE_CORRECT: 5,
    PRACTICAL_CORRECT: 10, // IMAGE_TAP, STEP_ORDER, AUDIO_DISCRIMINATION
    SESSION_COMPLETION_BONUS: 0,
  }
} as const;

export type ReviewStatus = 'UNREVIEWED' | 'IN_REVIEW' | 'REVIEWED' | 'BOOKMARKED';

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
  reviewStatus: ReviewStatus;
  reviewedAt?: string | null;
  reviewNotes?: string;
  createdAt?: any;
  updatedAt?: any;
  firstFailedAt?: any;
  lastFailedAt?: any;
}

export interface UnsolvedQuestionItem {
  record: UnsolvedQuestionDoc;
  mainQuestion: Question;
  followUpQuestion: Question | null;
}



