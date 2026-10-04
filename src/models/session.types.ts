/**
 * AiSteth Academy - Session & User Domain Models
 */

import { Question, UserAnswerPayload, AnswerEvaluationResult, QuestionCategory } from './question.types';

export type SessionStatus = 'IDLE' | 'IN_PROGRESS' | 'ANSWER_SUBMITTED' | 'COMPLETED';

export type DailyProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'QUESTIONS_COMPLETED'
  | 'REVIEW_VIEWED';

export interface AnswerRecord {
  questionId: string;
  question: Question;
  userAnswer: UserAnswerPayload | null;
  evaluation: AnswerEvaluationResult;
  timestamp: number;
}

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
  hintEliminatedOptions?: Record<number, ('option_a' | 'option_b' | 'option_c' | 'option_d')[]>;
  learnClueRevealed?: Record<number, boolean>;
  retryUsed?: Record<number, boolean>;
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
  startTime: number | null;
  endTime: number | null;
  hintEliminatedOptions?: Record<number, ('option_a' | 'option_b' | 'option_c' | 'option_d')[]>;
  learnClueRevealed?: Record<number, boolean>;
  retryUsed?: Record<number, boolean>;
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
  streakShieldConsumed?: boolean;
}

export const SESSION_CONFIG = {
  DEFAULT_SESSION_LENGTH: 10,
  XP_REWARDS: {
    MCQ_CORRECT: 5,
    TRUE_FALSE_CORRECT: 5,
    PRACTICAL_CORRECT: 10, // IMAGE_TAP, STEP_ORDER, AUDIO_DISCRIMINATION
    SESSION_COMPLETION_BONUS: 10,
  }
} as const;
