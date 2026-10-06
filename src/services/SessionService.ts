/**
 * AiSteth Academy — Client Session & Progression Service
 * Specification: Frozen Three-Power-Up System & Client-Authoritative Daily Session Lifecycle
 *
 * Append-only attempt logger and daily session lifecycle service.
 * Active power-ups: 50/50, LEARN, STREAK SHIELD.
 * HINT and RETRY are permanently removed.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion
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
    FIFTY_FIFTY: string[];
    LEARN: string[];
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
  powerUpsActive: string[];
  clientTimestamp: number;
  createdAt: any;
  serverTimestamp: any;
}

export class SessionService {
  private finalizingSessionIds = new Set<string>();

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
        FIFTY_FIFTY: [],
        LEARN: [],
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
   * Trainee answers are final upon submission (RETRY is permanently removed).
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

      if (payload.result === 'CORRECT') {
        updates.correctCount = increment(1);
      }

      if (payload.powerUpsActive && payload.powerUpsActive.length > 0) {
        if (payload.powerUpsActive.includes('FIFTY_FIFTY')) {
          updates['powerUpsUsed.FIFTY_FIFTY'] = arrayUnion(payload.questionId);
        }
        if (payload.powerUpsActive.includes('LEARN')) {
          updates['powerUpsUsed.LEARN'] = arrayUnion(payload.questionId);
        }
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
   * Strictly idempotent: guards against duplicate calls, double-clicks, network retries, and refresh cycles.
   * If session is already finalized (or rules reject updating completed session), progression is not re-incremented.
   */
  public async finalizeSession(
    uid: string,
    sessionId: string,
    totalXpEarned: number,
    correctCount: number = 0,
    totalQuestions: number = 10
  ): Promise<boolean> {
    // 1. In-memory concurrency guard: Prevent duplicate in-flight requests for same session
    if (this.finalizingSessionIds.has(sessionId)) {
      console.info(`[SessionService] Session ${sessionId} finalization already in-flight. Skipping duplicate call.`);
      return false;
    }
    this.finalizingSessionIds.add(sessionId);

    try {
      const sessionRef = doc(db, 'users', uid, 'dailySessions', sessionId);
      const userRef = doc(db, 'users', uid);

      // 2. Pre-check: Inspect current session state in Firestore
      try {
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) {
          console.warn(`[SessionService] Session ${sessionId} does not exist. Aborting finalization.`);
          return false;
        }

        const sessionData = sessionSnap.data();
        const terminalStatuses = ['COMPLETED', 'REVIEW_COMPLETED', 'REVIEW_VIEWED', 'QUESTIONS_COMPLETED'];
        if (terminalStatuses.includes(sessionData?.status) || sessionData?.reviewViewed === true) {
          console.info(`[SessionService] Session ${sessionId} is already finalized (status: ${sessionData?.status}). Skipping duplicate finalization.`);
          return false;
        }
      } catch (checkErr) {
        console.warn(`[SessionService] Error inspecting session state for ${sessionId}:`, checkErr);
      }

      // 3. Atomically transition session status to REVIEW_COMPLETED.
      // Firestore Security Rules strictly reject this update if status is already COMPLETED / REVIEW_COMPLETED.
      try {
        await updateDoc(sessionRef, {
          status: 'REVIEW_COMPLETED',
          reviewViewed: true,
          completedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        // If Firestore rules or concurrent write rejected the update, ABORT immediately.
        console.warn(`[SessionService] Failed or blocked transition of dailySession ${sessionId} to REVIEW_COMPLETED. Aborting progression update:`, err);
        return false;
      }

      // 4. Update trainee progression in users/{uid} ONLY after session transition succeeded
      try {
        const todayDateStr = getResolvedCalendarDate();
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const currentLearningState = data.learningState || {};
          const oldXp = currentLearningState.totalXp || 0;
          const oldStreak = currentLearningState.currentStreak || 0;
          const oldSessions = currentLearningState.completedSessionsCount || 0;
          const oldQuestions = currentLearningState.completedQuestionsCount || 0;
          const oldCorrect = currentLearningState.totalCorrectAnswersCount || 0;
          const oldLongest = currentLearningState.longestStreak || 0;
          const newStreak = oldStreak + 1;

          await updateDoc(userRef, {
            'learningState.totalXp': oldXp + Math.min(totalXpEarned, 200),
            'learningState.currentStreak': newStreak,
            'learningState.completedSessionsCount': oldSessions + 1,
            'learningState.completedQuestionsCount': oldQuestions + totalQuestions,
            'learningState.totalCorrectAnswersCount': oldCorrect + correctCount,
            'learningState.longestStreak': Math.max(oldLongest, newStreak),
            'learningState.lastActiveDate': todayDateStr,
            updatedAt: serverTimestamp(),
          });
          return true;
        }
      } catch (err) {
        console.warn('[SessionService] Failed to update user progression:', err);
      }

      return false;
    } finally {
      this.finalizingSessionIds.delete(sessionId);
    }
  }
}

export const defaultSessionService = new SessionService();
