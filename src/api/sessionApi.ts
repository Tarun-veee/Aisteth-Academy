import { apiFetch } from './client';
import { UserStats, BranchState } from '../models/session.types';
import { Question, AnswerEvaluationResult, UserAnswerPayload, normalizeQuestion } from '../models/question.types';

export interface TodaySessionApiResponse {
  session: any;
  questions: Question[];
}

export interface RecordAttemptApiPayload {
  sessionId: string;
  questionId: string;
  questionIndex: number;
  userAnswerPayload: UserAnswerPayload;
  powerUpsActive?: string[];
  idempotencyKey?: string;
  selectedOption?: any;
  branchState?: BranchState;
  /** @deprecated Discarded on backend — completion is strictly server-authoritative */
  isSessionComplete?: boolean;
}

export interface RecordAttemptApiResponse {
  success: boolean;
  attemptId: string;
  evaluation: AnswerEvaluationResult;
  questionIndex?: number;
  branchState?: BranchState;
  result?: 'CORRECT' | 'INCORRECT';
  xpAwarded?: number;
  isSessionComplete?: boolean;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'QUESTIONS_COMPLETED' | 'REVIEW_COMPLETED' | 'REVIEW_VIEWED';
  questionsCompleted?: boolean;
  currentQuestionIndex?: number;
  totalXpEarned?: number;
  correctCount?: number;
}

export interface FinalizeSessionApiPayload {
  sessionId: string;
  totalXpEarned: number;
  correctCount: number;
  totalQuestions?: number;
}

export interface FinalizeSessionApiResponse {
  success: boolean;
  alreadyFinalized: boolean;
  updatedStats?: UserStats;
}

export const sessionApi = {
  async getTodaySession(date?: string): Promise<TodaySessionApiResponse> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await apiFetch<TodaySessionApiResponse>(`/sessions/today${query}`, {
      method: 'GET',
    });
    if (res && Array.isArray(res.questions)) {
      res.questions = res.questions.map(normalizeQuestion);
    }
    return res;
  },

  async recordAttempt(payload: RecordAttemptApiPayload): Promise<RecordAttemptApiResponse> {
    return apiFetch<RecordAttemptApiResponse>('/sessions/today/attempts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async finalizeSession(payload: FinalizeSessionApiPayload): Promise<FinalizeSessionApiResponse> {
    return apiFetch<FinalizeSessionApiResponse>('/sessions/today/finalize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

