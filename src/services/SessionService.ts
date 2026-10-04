/**
 * AiSteth Academy — Client Session & Progression Service
 * Specification: v2.7.0-SPARK-SPEC
 *
 * Client-Authoritative Daily Session Lifecycle & Append-Only Attempt Logger
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getResolvedCalendarDate,
  selectSessionQuestions
} from '../utils/sessionSelection';

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
  powerUpsUsed: {
    HINT: string[];
    LEARN: string[];
    RETRY: string[];
  };
  startedAt: any;
  createdAt: any;
  updatedAt: any;
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
  isRetry: boolean;
  retryOfAttemptId?: string | null;
  powerUpsActive: string[];
  clientTimestamp: number;
  createdAt: any;
  serverTimestamp: any;
}

export class SessionService {
  /**
   * Starts or resumes a daily session for a user on a given local date.
   */
  public async startDailySession(
    uid: string,
    dateStr: string = getResolvedCalendarDate()
  ): Promise<DailySessionDoc> {
    const sessionId = `daily_${dateStr}_${uid.substring(0, 8)}`;
    const sessionRef = doc(db, 'users', uid, 'dailySessions', sessionId);

    try {
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        return snap.data() as DailySessionDoc;
      }
    } catch (err) {
      console.warn('Could not read existing daily session:', err);
    }

    // Generate new 10-question set deterministically
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
      powerUpsUsed: {
        HINT: [],
        LEARN: [],
        RETRY: [],
      },
      startedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(sessionRef, newSession);
    } catch (err) {
      console.error('Failed to create dailySession in Firestore:', err);
    }

    return newSession;
  }

  /**
   * Submits an append-only attempt record and updates the active session.
   */
  public async recordAttempt(
    uid: string,
    sessionId: string,
    payload: {
      questionId: string;
      questionIndex: number;
      userAnswerPayload: Record<string, any>;
      result: 'CORRECT' | 'INCORRECT';
      xpAwarded: number;
      isRetry?: boolean;
      retryOfAttemptId?: string | null;
      powerUpsActive?: string[];
      isSessionComplete?: boolean;
    }
  ): Promise<string> {
    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const attemptRef = doc(db, 'users', uid, 'attempts', attemptId);

    const attemptDoc: AttemptDoc = {
      attemptId,
      dailySessionId: sessionId,
      uid,
      userId: uid,
      questionId: payload.questionId,
      contentReleaseId: 'rel_v1_0_0',
      questionIndex: payload.questionIndex,
      userAnswerPayload: payload.userAnswerPayload,
      result: payload.result,
      xpAwarded: payload.xpAwarded,
      isRetry: Boolean(payload.isRetry),
      retryOfAttemptId: payload.retryOfAttemptId || null,
      powerUpsActive: payload.powerUpsActive || [],
      clientTimestamp: Date.now(),
      createdAt: serverTimestamp(),
      serverTimestamp: serverTimestamp(),
    };

    // 1. Write append-only attempt
    try {
      await setDoc(attemptRef, attemptDoc);
    } catch (err) {
      console.error('Failed to write attempt to Firestore:', err);
    }

    // 2. Update session state
    try {
      const sessionRef = doc(db, 'users', uid, 'dailySessions', sessionId);
      const updates: Record<string, any> = {
        currentQuestionIndex: Math.min(payload.questionIndex + 1, 9),
        totalXpEarned: increment(payload.xpAwarded),
        updatedAt: serverTimestamp(),
      };

      if (payload.result === 'CORRECT' && !payload.isRetry) {
        updates.correctCount = increment(1);
      }

      if (payload.isSessionComplete || payload.questionIndex >= 9) {
        updates.status = 'QUESTIONS_COMPLETED';
        updates.questionsCompleted = true;
      }

      await updateDoc(sessionRef, updates);
    } catch (err) {
      console.warn('Failed to update dailySession state:', err);
    }

    return attemptId;
  }

  /**
   * Finalizes the daily session and increments trainee progression in Firestore.
   */
  public async finalizeSession(uid: string, sessionId: string, totalXpEarned: number): Promise<void> {
    const sessionRef = doc(db, 'users', uid, 'dailySessions', sessionId);
    const userRef = doc(db, 'users', uid);

    try {
      await updateDoc(sessionRef, {
        status: 'REVIEW_COMPLETED',
        reviewViewed: true,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Failed to finalize dailySession:', err);
    }

    try {
      const todayDateStr = getResolvedCalendarDate();
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const currentLearningState = data.learningState || {};
        const oldXp = currentLearningState.totalXp || 0;
        const oldStreak = currentLearningState.currentStreak || 0;
        const oldSessions = currentLearningState.completedSessionsCount || 0;

        await updateDoc(userRef, {
          'learningState.totalXp': oldXp + Math.min(totalXpEarned, 200),
          'learningState.currentStreak': oldStreak + 1,
          'learningState.completedSessionsCount': oldSessions + 1,
          'learningState.lastActiveDate': todayDateStr,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Failed to update user progression:', err);
    }
  }
}

export const defaultSessionService = new SessionService();
