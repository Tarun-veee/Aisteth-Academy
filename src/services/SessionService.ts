/**
 * AiSteth Academy — Client Session & Progression Service
 * Specification: Zero Firebase SDK in Frontend — Layered Node.js/Express REST Architecture
 */

import {
  getResolvedCalendarDate,
  selectSessionQuestions
} from '../utils/sessionSelection';
import { sessionApi, RecordAttemptApiResponse } from '../api/sessionApi';
import { BranchState } from '../models/session.types';

/**
 * Generates the canonical session ID standard for trainee daily sessions.
 */
export function generateCanonicalSessionId(
  uid: string,
  dateStr: string = getResolvedCalendarDate()
): string {
  return `daily_${dateStr}_${uid.substring(0, 8)}`;
}

export interface DailySessionDoc {
  sessionId: string;
  uid: string;
  userId: string;
  localDate: string;
  contentReleaseId: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'QUESTIONS_COMPLETED' | 'REVIEW_COMPLETED' | 'REVIEW_VIEWED';
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
  clientTimestamp: number;
  createdAt?: any;
  serverTimestamp?: any;
}

export class SessionService {
  private finalizingSessionIds = new Set<string>();

  /**
   * Starts or resumes a daily session via Express Backend API (/api/v1/sessions/today).
   */
  public async startDailySession(
    uid: string,
    dateStr: string = getResolvedCalendarDate()
  ): Promise<DailySessionDoc> {
    const sessionId = generateCanonicalSessionId(uid, dateStr);

    try {
      const res = await sessionApi.getTodaySession(dateStr);
      if (res && res.session) {
        return res.session as DailySessionDoc;
      }
    } catch (err) {
      console.warn('[SessionService] Backend startDailySession warning:', err);
    }

    // Local fallback for offline mode or test mock runner
    const selectedQuestionIds = selectSessionQuestions(dateStr);
    const newSession: DailySessionDoc = {
      sessionId,
      uid,
      userId: uid,
      localDate: dateStr,
      contentReleaseId: 'rel_v1_0_0',
      status: 'IN_PROGRESS',
      questionIds: selectedQuestionIds,
      currentQuestionIndex: 0,
      questionsCompleted: false,
      reviewViewed: false,
      totalXpEarned: 0,
      correctCount: 0,
      accuracy: 0,
      branchState: 'MAIN',
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return newSession;
  }

  /**
   * Submits an append-only attempt record via Express Backend API (/api/v1/sessions/today/attempts).
   * Server-authoritative: passes idempotency key, branchState, and payload to backend.
   * Throws on failure without fake attempt ID fallback.
   */
  public async recordAttempt(
    _uid: string,
    sessionId: string,
    payload: {
      questionId: string;
      questionIndex: number;
      userAnswerPayload: Record<string, any>;
      idempotencyKey?: string;
      selectedOption?: any;
      branchState?: BranchState;
      result?: 'CORRECT' | 'INCORRECT';
      xpAwarded?: number;
      isSessionComplete?: boolean;
    }
  ): Promise<RecordAttemptApiResponse> {
    const res = await sessionApi.recordAttempt({
      sessionId,
      questionId: payload.questionId,
      questionIndex: payload.questionIndex,
      userAnswerPayload: payload.userAnswerPayload as any,
      idempotencyKey: payload.idempotencyKey,
      selectedOption: payload.selectedOption,
      branchState: payload.branchState,
      isSessionComplete: payload.isSessionComplete,
    });

    return res;
  }


  /**
   * Finalizes the daily session atomically via Express Backend API (/api/v1/sessions/today/finalize).
   * Guarded against duplicate in-flight calls and double-clicks.
   */
  public async finalizeSession(
    _uid: string,
    sessionId: string,
    totalXpEarned: number,
    correctCount: number = 0,
    totalQuestions: number = 10
  ): Promise<boolean> {
    if (this.finalizingSessionIds.has(sessionId)) {
      console.info(`[SessionService] Session ${sessionId} finalization already in-flight. Skipping duplicate call.`);
      return false;
    }
    this.finalizingSessionIds.add(sessionId);

    try {
      const res = await sessionApi.finalizeSession({
        sessionId,
        totalXpEarned,
        correctCount,
        totalQuestions,
      });

      if (res.alreadyFinalized) {
        console.info(`[SessionService] Session ${sessionId} is already finalized. Skipping duplicate finalization.`);
        return false;
      }

      return Boolean(res.success);
    } catch (err) {
      console.warn(`[SessionService] Backend finalizeSession failed for ${sessionId}:`, err);
      return false;
    } finally {
      this.finalizingSessionIds.delete(sessionId);
    }
  }
}

export const defaultSessionService = new SessionService();
