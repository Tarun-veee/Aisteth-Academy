import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Question,
  UserAnswerPayload,
  AnswerEvaluationResult,
  normalizeQuestion,
} from '../models/question.types';
import {
  SessionState,
  StoredSessionRecord,
  SESSION_CONFIG,
  UserStats,
  DailySessionData,
  BranchState,
} from '../models/session.types';
import { AnswerEvaluator } from '../services/AnswerEvaluator';
import { defaultQuestionService, QuestionService } from '../services/QuestionService';
import {
  defaultStorageRepository,
  StorageRepository,
  getLocalTodayDateString,
} from '../repositories/StorageRepository';
import { defaultSessionService, SessionService, generateCanonicalSessionId } from '../services/SessionService';
import { defaultAuthService } from '../services/AuthService';
import { sessionApi } from '../api/sessionApi';
import { userApi } from '../api/userApi';

/**
 * Generates an 8 to 64-char alphanumeric nonce matching `[a-zA-Z0-9_-]{8,64}`
 */
export function generateSubmissionNonce(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let nonce = '';
  for (let i = 0; i < 16; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/**
 * Generates a canonical idempotency key compliant with backend parser:
 * ^idem_([a-zA-Z0-9_-]{1,64})_q([0-9]{1,2})_(MAIN|FOLLOW_UP|REATTEMPT_MAIN)_([a-zA-Z0-9_-]{8,64})$
 */
export function generateIdempotencyKey(
  sessionId: string,
  questionIndex: number,
  branchState: BranchState,
  nonce: string = generateSubmissionNonce()
): string {
  return `idem_${sessionId}_q${questionIndex}_${branchState}_${nonce}`;
}

export function useLearningSession(
  questionService: QuestionService = defaultQuestionService,
  storageRepository: StorageRepository = defaultStorageRepository,
  sessionService: SessionService = defaultSessionService
) {
  const [session, setSession] = useState<SessionState>({
    status: 'IDLE',
    dailyStatus: 'NOT_STARTED',
    sessionId: '',
    currentIndex: 0,
    questions: [],
    currentAnswer: null,
    currentEvaluation: null,
    history: [],
    totalXpEarned: 0,
    correctCount: 0,
    questionsCompleted: false,
    reviewViewed: false,
    branchState: 'MAIN',
    activeMainQuestionId: undefined,
    activeFollowUpQuestionId: null,
    activeFollowUpQuestion: null,
    isReattempt: false,
    isSubmitting: false,
    pendingIdempotencyKey: null,
    submissionError: null,
    serverPendingTransition: null,
    startTime: null,
    endTime: null,
  });

  const [userStats, setUserStats] = useState<UserStats>({
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    completedQuestionsCount: 0,
    completedSessionsCount: 0,
    totalCorrectAnswersCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const isSubmittingRef = useRef(false);
  const pendingIdempotencyKeyRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // Load user stats and today's session progress on initial mount
  const refreshUserStats = useCallback(async () => {
    try {
      const currentUid = defaultAuthService.getSession()?.userId;
      if (currentUid) {
        const res = await userApi.getProfile();
        if (res && res.stats) {
          setUserStats(res.stats);
          await storageRepository.saveUserStats(res.stats);
          return;
        }
      }
    } catch {
      // Fallback to storage
    }
    const stats = await storageRepository.getUserStats();
    setUserStats(stats);
  }, [storageRepository]);

  const initDailySession = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshUserStats();
      const todayStr = getLocalTodayDateString();
      const currentUid = defaultAuthService.getSession()?.userId;

      // 1. If authenticated, attempt to sync with backend session first
      if (currentUid) {
        try {
          const res = await sessionApi.getTodaySession(todayStr);
          if (res && res.session) {
            const s = res.session;
            const cycleDate = s.localDate || todayStr;
            const daily = await storageRepository.getDailySession(cycleDate);
            const rawQuestions = Array.isArray(res.questions) && res.questions.length > 0
              ? res.questions
              : (daily?.questions && daily.questions.length > 0
                ? daily.questions
                : await questionService.createDailySession(SESSION_CONFIG.DEFAULT_SESSION_LENGTH));
            const serverQuestions = rawQuestions.map(normalizeQuestion);

            const isTerminal = s.status === 'QUESTIONS_COMPLETED' ||
              s.status === 'REVIEW_COMPLETED' ||
              s.status === 'REVIEW_VIEWED' ||
              Boolean(s.questionsCompleted);

            let activeFuQ: Question | null = null;
            if (s.branchState === 'FOLLOW_UP') {
              const fuId = s.activeFollowUpQuestionId;
              activeFuQ = fuId ? await questionService.getQuestionById(fuId) : null;
              if (!activeFuQ && s.questionIds?.[s.currentQuestionIndex]) {
                activeFuQ = await questionService.getFollowUpQuestion(s.questionIds[s.currentQuestionIndex]);
              }
            }

            // Sync authoritative server session into local IndexedDB
            if (serverQuestions.length > 0) {
              const syncedDailyData: DailySessionData = {
                sessionId: s.sessionId,
                date: cycleDate,
                status: isTerminal ? 'QUESTIONS_COMPLETED' : 'IN_PROGRESS',
                questionsCompleted: Boolean(s.questionsCompleted || isTerminal),
                reviewViewed: Boolean(s.reviewViewed || s.status === 'REVIEW_VIEWED'),
                currentIndex: s.currentQuestionIndex ?? 0,
                questions: serverQuestions,
                history: daily?.history || [],
                score: s.correctCount ?? 0,
                totalQuestions: serverQuestions.length,
                totalXpEarned: s.totalXpEarned ?? 0,
                correctCount: s.correctCount ?? 0,
                branchState: s.branchState || 'MAIN',
              };
              await storageRepository.saveDailySession(syncedDailyData);
            }

            setSession((prev) => {
              if (
                prev.sessionId === s.sessionId &&
                (prev.status === 'IN_PROGRESS' || prev.status === 'ANSWER_SUBMITTED') &&
                prev.questions.length > 0 &&
                prev.currentIndex === (s.currentQuestionIndex ?? 0) &&
                prev.branchState === (s.branchState || 'MAIN') &&
                !prev.submissionError &&
                (prev.branchState === 'FOLLOW_UP' ? Boolean(prev.activeFollowUpQuestion) : Boolean(prev.questions[prev.currentIndex]))
              ) {
                return prev;
              }
              return {
                status: isTerminal ? 'COMPLETED' : (s.status === 'NOT_STARTED' ? 'IDLE' : 'IN_PROGRESS'),
                dailyStatus: s.status as any,
                sessionId: s.sessionId,
                currentIndex: s.currentQuestionIndex ?? 0,
                questions: serverQuestions,
                currentAnswer: prev.currentAnswer && prev.currentIndex === s.currentQuestionIndex && prev.branchState === s.branchState ? prev.currentAnswer : null,
                currentEvaluation: null,
                history: daily?.history || prev.history || [],
                totalXpEarned: s.totalXpEarned ?? 0,
                correctCount: s.correctCount ?? 0,
                questionsCompleted: Boolean(s.questionsCompleted || isTerminal),
                reviewViewed: Boolean(s.reviewViewed || s.status === 'REVIEW_VIEWED'),
                branchState: s.branchState || 'MAIN',
                activeMainQuestionId: s.activeMainQuestionId,
                activeFollowUpQuestionId: s.activeFollowUpQuestionId,
                activeFollowUpQuestion: activeFuQ,
                isReattempt: s.branchState === 'REATTEMPT_MAIN',
                isSubmitting: false,
                pendingIdempotencyKey: null,
                submissionError: null,
                serverPendingTransition: null,
                startTime: isTerminal ? null : (prev.startTime || Date.now()),
                endTime: isTerminal ? Date.now() : null,
              };
            });
            return;
          }
        } catch (serverErr: any) {
          console.warn('[useLearningSession] Backend initDailySession sync warning:', serverErr);
          setSession((prev) => ({
            ...prev,
            submissionError: prev.questions.length === 0
              ? (serverErr?.message || 'Unable to connect to learning server. Please ensure the backend is running and tap Retry.')
              : prev.submissionError,
          }));
        }
      }

      // 2. Local fallback from IndexedDB / StorageRepository
      const daily = await storageRepository.getDailySession(todayStr);
      if (daily) {
        if (daily.status === 'REVIEW_VIEWED') {
          setSession((prev) => {
            if (prev.status === 'IN_PROGRESS' || prev.status === 'ANSWER_SUBMITTED') return prev;
            return {
              status: 'COMPLETED',
              dailyStatus: 'REVIEW_VIEWED',
              sessionId: daily.sessionId,
              currentIndex: daily.currentIndex,
              questions: daily.questions,
              currentAnswer: null,
              currentEvaluation: null,
              history: daily.history,
              totalXpEarned: daily.totalXpEarned,
              correctCount: daily.correctCount,
              questionsCompleted: true,
              reviewViewed: true,
              branchState: daily.branchState || 'MAIN',
              activeFollowUpQuestion: null,
              isReattempt: daily.isReattempt || false,
              isSubmitting: false,
              pendingIdempotencyKey: null,
              submissionError: null,
              serverPendingTransition: null,
              startTime: null,
              endTime: null,
            };
          });
        } else if (daily.status === 'QUESTIONS_COMPLETED') {
          setSession((prev) => {
            if (prev.status === 'IN_PROGRESS' || prev.status === 'ANSWER_SUBMITTED') return prev;
            return {
              status: 'COMPLETED',
              dailyStatus: 'QUESTIONS_COMPLETED',
              sessionId: daily.sessionId,
              currentIndex: daily.currentIndex,
              questions: daily.questions,
              currentAnswer: null,
              currentEvaluation: null,
              history: daily.history,
              totalXpEarned: daily.totalXpEarned,
              correctCount: daily.correctCount,
              questionsCompleted: true,
              reviewViewed: false,
              branchState: daily.branchState || 'MAIN',
              activeFollowUpQuestion: null,
              isReattempt: daily.isReattempt || false,
              isSubmitting: false,
              pendingIdempotencyKey: null,
              submissionError: null,
              serverPendingTransition: null,
              startTime: null,
              endTime: null,
            };
          });
        } else if (daily.status === 'IN_PROGRESS') {
          setSession((prev) => {
            if (prev.status === 'IN_PROGRESS' || prev.status === 'ANSWER_SUBMITTED') return prev;
            return {
              status: 'IN_PROGRESS',
              dailyStatus: 'IN_PROGRESS',
              sessionId: daily.sessionId,
              currentIndex: daily.currentIndex,
              questions: daily.questions,
              currentAnswer: null,
              currentEvaluation: null,
              history: daily.history,
              totalXpEarned: daily.totalXpEarned,
              correctCount: daily.correctCount,
              questionsCompleted: false,
              reviewViewed: false,
              branchState: daily.branchState || 'MAIN',
              activeFollowUpQuestion: null,
              isReattempt: daily.isReattempt || false,
              isSubmitting: false,
              pendingIdempotencyKey: null,
              submissionError: null,
              serverPendingTransition: null,
              startTime: Date.now(),
              endTime: null,
            };
          });
        }
      } else {
        setSession((prev) => {
          if ((prev.status === 'IN_PROGRESS' || prev.status === 'ANSWER_SUBMITTED') && prev.questions.length > 0) return prev;
          return {
            status: 'IDLE',
            dailyStatus: 'NOT_STARTED',
            sessionId: '',
            currentIndex: 0,
            questions: [],
            currentAnswer: null,
            currentEvaluation: null,
            history: [],
            totalXpEarned: 0,
            correctCount: 0,
            questionsCompleted: false,
            reviewViewed: false,
            branchState: 'MAIN',
            activeFollowUpQuestion: null,
            isReattempt: false,
            isSubmitting: false,
            pendingIdempotencyKey: null,
            submissionError: null,
            serverPendingTransition: null,
            startTime: null,
            endTime: null,
          };
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [storageRepository, refreshUserStats, questionService]);

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      initDailySession();
    }
  }, [initDailySession]);

  /**
   * Starts or resumes today's learning mission.
   * Syncs with server SessionService if authenticated.
   */
  const startDailySession = useCallback(
    async (count: number = SESSION_CONFIG.DEFAULT_SESSION_LENGTH) => {
      setIsLoading(true);
      try {
        const todayStr = getLocalTodayDateString();
        const currentUid = defaultAuthService.getSession()?.userId;

        let serverSession: any = null;
        let sessionQuestions: Question[] = [];

        if (currentUid) {
          try {
            const apiRes = await sessionApi.getTodaySession(todayStr);
            if (apiRes && apiRes.session) {
              serverSession = apiRes.session;
              if (Array.isArray(apiRes.questions) && apiRes.questions.length > 0) {
                sessionQuestions = apiRes.questions;
              }
            }
          } catch (apiErr) {
            console.warn('[useLearningSession] startDailySession API warning:', apiErr);
          }
        }

        const newSessionId = serverSession?.sessionId || (currentUid
          ? generateCanonicalSessionId(currentUid, todayStr)
          : `daily_${todayStr}`);

        if (sessionQuestions.length === 0) {
          const pastSessions = await storageRepository.getAllSessions();
          sessionQuestions = await questionService.createDailySession(count, pastSessions);
        }

        // Check if server session is already completed
        if (serverSession && (serverSession.questionsCompleted || serverSession.status === 'QUESTIONS_COMPLETED' || serverSession.status === 'REVIEW_VIEWED')) {
          setSession((prev) => ({
            ...prev,
            status: 'COMPLETED',
            dailyStatus: serverSession.status,
            sessionId: newSessionId,
            currentIndex: serverSession.currentQuestionIndex ?? sessionQuestions.length,
            questions: sessionQuestions,
            totalXpEarned: serverSession.totalXpEarned ?? 0,
            correctCount: serverSession.correctCount ?? 0,
            questionsCompleted: true,
            reviewViewed: Boolean(serverSession.reviewViewed || serverSession.status === 'REVIEW_VIEWED'),
            branchState: serverSession.branchState || 'MAIN',
            activeFollowUpQuestion: null,
            isReattempt: false,
            isSubmitting: false,
            pendingIdempotencyKey: null,
            submissionError: null,
            serverPendingTransition: null,
          }));
          return;
        }

        const newBranch: BranchState = serverSession?.branchState || 'MAIN';
        let resolvedFollowUp: Question | null = null;
        if (newBranch === 'FOLLOW_UP') {
          const fuId = serverSession?.activeFollowUpQuestionId;
          resolvedFollowUp = fuId ? await questionService.getQuestionById(fuId) : null;
          if (!resolvedFollowUp && serverSession?.questionIds?.[serverSession?.currentQuestionIndex]) {
            resolvedFollowUp = await questionService.getFollowUpQuestion(serverSession.questionIds[serverSession.currentQuestionIndex]);
          }
        }

        const initialIndex = serverSession?.currentQuestionIndex ?? 0;
        const initialXp = serverSession?.totalXpEarned ?? 0;
        const initialCorrect = serverSession?.correctCount ?? 0;

        const newDailyData: DailySessionData = {
          sessionId: newSessionId,
          date: todayStr,
          status: 'IN_PROGRESS',
          questionsCompleted: false,
          reviewViewed: false,
          currentIndex: initialIndex,
          questions: sessionQuestions,
          history: [],
          score: initialCorrect,
          totalQuestions: sessionQuestions.length,
          totalXpEarned: initialXp,
          correctCount: initialCorrect,
          branchState: newBranch,
        };

        await storageRepository.saveDailySession(newDailyData);

        setSession({
          status: 'IN_PROGRESS',
          dailyStatus: 'IN_PROGRESS',
          sessionId: newSessionId,
          currentIndex: initialIndex,
          questions: sessionQuestions,
          currentAnswer: null,
          currentEvaluation: null,
          history: [],
          totalXpEarned: initialXp,
          correctCount: initialCorrect,
          questionsCompleted: false,
          reviewViewed: false,
          branchState: newBranch,
          activeMainQuestionId: serverSession?.activeMainQuestionId,
          activeFollowUpQuestionId: serverSession?.activeFollowUpQuestionId,
          activeFollowUpQuestion: resolvedFollowUp,
          isReattempt: newBranch === 'REATTEMPT_MAIN',
          isSubmitting: false,
          pendingIdempotencyKey: null,
          submissionError: null,
          serverPendingTransition: null,
          startTime: Date.now(),
          endTime: null,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [questionService, storageRepository]
  );

  /**
   * Sets or updates the active answer payload before submission.
   */
  const setAnswer = useCallback((answer: UserAnswerPayload) => {
    setSession((prev) => {
      if (prev.status !== 'IN_PROGRESS') return prev;
      return { ...prev, currentAnswer: answer };
    });
  }, []);

  /**
   * Submits the current question answer for server-authoritative evaluation.
   * Trainee answers are FINAL. Passes canonical idempotency key and branch state.
   */
  const submitCurrentAnswer = useCallback(async () => {
    // 1. Guard against concurrent duplicate submissions
    if (isSubmittingRef.current) return;
    if (session.status !== 'IN_PROGRESS' || !session.currentAnswer) return;

    const activeQ = session.branchState === 'FOLLOW_UP'
      ? session.activeFollowUpQuestion
      : session.questions[session.currentIndex];

    if (!activeQ) return;
    if (!AnswerEvaluator.isValidAnswer(activeQ, session.currentAnswer)) return;

    isSubmittingRef.current = true;
    setSession((prev) => ({ ...prev, isSubmitting: true, submissionError: null }));

    const currentUid = defaultAuthService.getSession()?.userId || 'anonymous';
    const todayStr = getLocalTodayDateString();
    const currentSessionId = session.sessionId || generateCanonicalSessionId(currentUid, todayStr);
    const currentBranch = session.branchState || 'MAIN';
    const currentIndex = session.currentIndex;

    // 2. Canonical Idempotency Key Management:
    // Retain key on uncertain network failure; generate fresh key only for genuinely new submission.
    const idemKey = pendingIdempotencyKeyRef.current || generateIdempotencyKey(
      currentSessionId,
      currentIndex,
      currentBranch
    );
    pendingIdempotencyKeyRef.current = idemKey;

    try {
      const selectedOpt = (session.currentAnswer as any)?.selected_option ??
                          (session.currentAnswer as any)?.selected_boolean ??
                          (session.currentAnswer as any)?.tap_coordinate;

      // 3. Backend-Authoritative Submission
      const currentQId = activeQ.question_id || (activeQ as any).questionId;
      const response = await sessionService.recordAttempt(currentUid, currentSessionId, {
        questionId: currentQId,
        questionIndex: currentIndex,
        userAnswerPayload: session.currentAnswer,
        idempotencyKey: idemKey,
        selectedOption: selectedOpt,
        branchState: currentBranch,
      });

      // 4. Server authoritative result handling
      pendingIdempotencyKeyRef.current = null;
      const isCorrect = Boolean(response.result === 'CORRECT' || response.evaluation?.is_correct);
      const xpAwarded = typeof response.xpAwarded === 'number' ? response.xpAwarded : 0;
      const newTotalXp = typeof response.totalXpEarned === 'number'
        ? response.totalXpEarned
        : session.totalXpEarned + xpAwarded;
      const newCorrectCount = typeof response.correctCount === 'number'
        ? response.correctCount
        : session.correctCount + (isCorrect ? 1 : 0);

      const clientEval = AnswerEvaluator.evaluate(activeQ, session.currentAnswer);
      const serverEval: AnswerEvaluationResult = {
        ...clientEval,
        is_correct: isCorrect,
        status: isCorrect ? 'CORRECT' : 'INCORRECT',
        awarded_xp: xpAwarded,
        explanation: response.evaluation?.explanation || clientEval.explanation || activeQ.explanation || '',
      };

      const newHistoryItem = {
        questionId: currentQId,
        question: activeQ,
        userAnswer: session.currentAnswer,
        evaluation: serverEval,
        timestamp: Date.now(),
      };

      const nextBranch = response.branchState || 'MAIN';
      const targetQuestionIndex = typeof response.currentQuestionIndex === 'number'
        ? response.currentQuestionIndex
        : (typeof response.questionIndex === 'number' ? response.questionIndex : currentIndex);
      const isComplete = Boolean(response.isSessionComplete || response.questionsCompleted);

      // Lineage resolution: if transitioning to FOLLOW_UP, resolve canonical follow-up question
      let resolvedFollowUp: Question | null = null;
      if (nextBranch === 'FOLLOW_UP') {
        const fuId = (response as any).activeFollowUpQuestionId;
        if (fuId) {
          resolvedFollowUp = await questionService.getQuestionById(fuId);
        }
        if (!resolvedFollowUp) {
          resolvedFollowUp = await questionService.getFollowUpQuestion(currentQId);
        }
        if (!resolvedFollowUp) {
          throw new Error(`CANONICAL_LINEAGE_NOT_FOUND: Could not resolve follow-up question for '${currentQId}'.`);
        }
      }

      const updatedQuestions = (nextBranch === 'FOLLOW_UP' && resolvedFollowUp)
        ? [
            ...session.questions.slice(0, targetQuestionIndex),
            resolvedFollowUp,
            ...session.questions.slice(targetQuestionIndex),
          ].slice(0, 10)
        : session.questions;

      setSession((prev) => ({
        ...prev,
        status: 'ANSWER_SUBMITTED',
        isSubmitting: false,
        pendingIdempotencyKey: null,
        submissionError: null,
        currentEvaluation: serverEval,
        questions: updatedQuestions,
        history: [...prev.history, newHistoryItem],
        totalXpEarned: newTotalXp,
        correctCount: newCorrectCount,
        activeFollowUpQuestion: nextBranch === 'FOLLOW_UP' ? resolvedFollowUp : prev.activeFollowUpQuestion,
        serverPendingTransition: {
          branchState: nextBranch,
          currentQuestionIndex: targetQuestionIndex,
          isSessionComplete: isComplete,
          totalXpEarned: newTotalXp,
          correctCount: newCorrectCount,
        },
      }));
    } catch (err: any) {
      console.error('[useLearningSession] submitCurrentAnswer error:', err);
      const status = err?.status;
      const message = err?.message || 'Submission failed.';

      if (status === 409) {
        if (message.includes('already completed')) {
          pendingIdempotencyKeyRef.current = null;
          setSession((prev) => ({
            ...prev,
            status: 'COMPLETED',
            dailyStatus: 'QUESTIONS_COMPLETED',
            questionsCompleted: true,
            isSubmitting: false,
            pendingIdempotencyKey: null,
            submissionError: 'Daily session is already completed.',
          }));
          return;
        } else if (message.includes('mismatch') || message.includes('MISMATCH')) {
          try {
            const res = await sessionApi.getTodaySession(todayStr);
            if (res && res.session) {
              const s = res.session;
              pendingIdempotencyKeyRef.current = null;
              setSession((prev) => ({
                ...prev,
                currentIndex: s.currentQuestionIndex ?? prev.currentIndex,
                branchState: s.branchState ?? 'MAIN',
                totalXpEarned: s.totalXpEarned ?? prev.totalXpEarned,
                correctCount: s.correctCount ?? prev.correctCount,
                questionsCompleted: Boolean(s.questionsCompleted),
                isSubmitting: false,
                pendingIdempotencyKey: null,
                submissionError: `Reconciled with server: ${message}`,
              }));
              return;
            }
          } catch (syncErr) {
            console.warn('[useLearningSession] Reconciliation sync failed:', syncErr);
          }
        } else if (message.includes('ATTEMPT_PAYLOAD_CONFLICT')) {
          pendingIdempotencyKeyRef.current = null;
          setSession((prev) => ({
            ...prev,
            isSubmitting: false,
            pendingIdempotencyKey: null,
            submissionError: 'Payload conflict detected. Please retry.',
          }));
          return;
        }
      }

      // Network failure / uncertain error: retain idempotency key for safe retry
      setSession((prev) => ({
        ...prev,
        isSubmitting: false,
        pendingIdempotencyKey: pendingIdempotencyKeyRef.current,
        submissionError: message || 'Network failure. Tap Check Answer to retry.',
      }));
    } finally {
      isSubmittingRef.current = false;
    }
  }, [session, questionService, sessionService]);



  /**
   * Advances to the next question or completes the session.
   * Server-authoritative: follows serverPendingTransition without client bonus XP.
   */
  const nextQuestion = useCallback(async () => {
    const transition = session.serverPendingTransition;
    const todayStr = getLocalTodayDateString();

    if (transition?.isSessionComplete || session.currentIndex >= session.questions.length) {
      const finalXp = session.totalXpEarned;
      const currentUid = defaultAuthService.getSession()?.userId;

      if (currentUid) {
        sessionService.finalizeSession(
          currentUid,
          session.sessionId,
          finalXp,
          session.correctCount,
          session.questions.length
        ).catch((err) => {
          console.warn('Firestore finalizeSession warning:', err);
        });
      }

      const completedDaily: DailySessionData = {
        sessionId: session.sessionId,
        date: todayStr,
        status: 'QUESTIONS_COMPLETED',
        questionsCompleted: true,
        reviewViewed: false,
        currentIndex: session.questions.length,
        questions: session.questions,
        history: session.history,
        score: session.correctCount,
        totalQuestions: session.questions.length,
        totalXpEarned: finalXp,
        correctCount: session.correctCount,
      };

      const storedRecord: StoredSessionRecord = {
        sessionId: session.sessionId,
        timestamp: Date.now(),
        totalQuestions: session.questions.length,
        correctCount: session.correctCount,
        xpEarned: finalXp,
        date: todayStr,
        answers: session.history.map((h) => ({
          questionId: h.questionId,
          isCorrect: h.evaluation.is_correct,
          userAnswer: h.userAnswer!,
          category: h.question.category,
        })),
      };

      Promise.all([
        storageRepository.saveSession(storedRecord),
        storageRepository.saveDailySession(completedDaily),
      ]).then(() => {
        refreshUserStats();
      });

      setSession((prev) => ({
        ...prev,
        status: 'COMPLETED',
        dailyStatus: 'QUESTIONS_COMPLETED',
        questionsCompleted: true,
        reviewViewed: false,
        totalXpEarned: finalXp,
        endTime: Date.now(),
        currentAnswer: null,
        currentEvaluation: null,
        serverPendingTransition: null,
      }));
      return;
    }

    const nextBranch = transition?.branchState || 'MAIN';
    const nextIdx = typeof transition?.currentQuestionIndex === 'number'
      ? transition.currentQuestionIndex
      : session.currentIndex + 1;

    const progressDaily: DailySessionData = {
      sessionId: session.sessionId,
      date: todayStr,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      reviewViewed: false,
      currentIndex: nextIdx,
      questions: session.questions,
      history: session.history,
      score: session.correctCount,
      totalQuestions: session.questions.length,
      totalXpEarned: session.totalXpEarned,
      correctCount: session.correctCount,
      branchState: nextBranch,
    };

    storageRepository.saveDailySession(progressDaily);

    setSession((prev) => ({
      ...prev,
      status: 'IN_PROGRESS',
      dailyStatus: 'IN_PROGRESS',
      currentIndex: nextIdx,
      branchState: nextBranch,
      isReattempt: nextBranch === 'REATTEMPT_MAIN',
      activeMainQuestionId: nextBranch === 'REATTEMPT_MAIN' ? (prev.activeMainQuestionId || prev.questions[nextIdx]?.question_id) : undefined,
      currentAnswer: null,
      currentEvaluation: null,
      serverPendingTransition: null,
      activeFollowUpQuestion: nextBranch === 'FOLLOW_UP' ? prev.activeFollowUpQuestion : null,
      submissionError: null,
    }));
  }, [session, sessionService, storageRepository, refreshUserStats]);

  /**
   * Marks session review as viewed and locks today's session.
   */
  const markReviewViewed = useCallback(async () => {
    const todayStr = getLocalTodayDateString();
    setSession((prev) => {
      const currentUid = defaultAuthService.getSession()?.userId;
      const fallbackSessionId = currentUid
        ? generateCanonicalSessionId(currentUid, todayStr)
        : `daily_${todayStr}`;

      const finishedDaily: DailySessionData = {
        sessionId: prev.sessionId || fallbackSessionId,
        date: todayStr,
        status: 'REVIEW_VIEWED',
        questionsCompleted: true,
        reviewViewed: true,
        currentIndex: prev.questions.length,
        questions: prev.questions,
        history: prev.history,
        score: prev.correctCount,
        totalQuestions: prev.questions.length,
        totalXpEarned: prev.totalXpEarned,
        correctCount: prev.correctCount,
      };

      storageRepository.saveDailySession(finishedDaily);

      return {
        ...prev,
        dailyStatus: 'REVIEW_VIEWED',
        reviewViewed: true,
        questionsCompleted: true,
      };
    });
    await refreshUserStats();
  }, [storageRepository, refreshUserStats]);

  const currentQuestion: Question | null = useMemo(() => {
    if (session.branchState === 'FOLLOW_UP') {
      return session.activeFollowUpQuestion || null;
    }
    if (session.branchState === 'REATTEMPT_MAIN' && session.activeMainQuestionId) {
      const match = session.questions.find((q) => q.question_id === session.activeMainQuestionId);
      if (match) return match;
    }
    if (session.questions.length > 0 && session.currentIndex < session.questions.length) {
      return session.questions[session.currentIndex];
    }
    return null;
  }, [
    session.branchState,
    session.activeFollowUpQuestion,
    session.activeMainQuestionId,
    session.questions,
    session.currentIndex,
  ]);

  const resetSessionState = useCallback(() => {
    setSession({
      status: 'IDLE',
      dailyStatus: 'NOT_STARTED',
      sessionId: '',
      currentIndex: 0,
      questions: [],
      currentAnswer: null,
      currentEvaluation: null,
      history: [],
      totalXpEarned: 0,
      correctCount: 0,
      questionsCompleted: false,
      reviewViewed: false,
      branchState: 'MAIN',
      activeMainQuestionId: undefined,
      activeFollowUpQuestionId: null,
      activeFollowUpQuestion: null,
      isReattempt: false,
      isSubmitting: false,
      pendingIdempotencyKey: null,
      submissionError: null,
      serverPendingTransition: null,
      startTime: null,
      endTime: null,
    });
    setUserStats({
      totalXp: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
      completedQuestionsCount: 0,
      completedSessionsCount: 0,
      totalCorrectAnswersCount: 0,
    });
  }, []);

  return {
    session,
    userStats,
    isLoading,
    currentQuestion,
    startDailySession,
    initDailySession,
    setAnswer,
    submitCurrentAnswer,
    nextQuestion,
    markReviewViewed,
    refreshUserStats,
    resetSessionState,
  };
}
