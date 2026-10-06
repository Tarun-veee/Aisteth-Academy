import { useState, useCallback, useEffect } from 'react';
import {
  Question,
  UserAnswerPayload,
  MCQQuestion
} from '../models/question.types';
import {
  SessionState,
  StoredSessionRecord,
  SESSION_CONFIG,
  UserStats,
  DailySessionData
} from '../models/session.types';
import { AnswerEvaluator } from '../services/AnswerEvaluator';
import { PowerUpService } from '../services/PowerUpService';
import { defaultQuestionService, QuestionService } from '../services/QuestionService';
import {
  defaultStorageRepository,
  StorageRepository,
  getLocalTodayDateString
} from '../repositories/StorageRepository';
import { defaultSessionService, SessionService } from '../services/SessionService';
import { defaultAuthService } from '../services/AuthService';

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
    startTime: null,
    endTime: null,
    fiftyFiftyEliminatedOptions: {},
    learnClueRevealed: {},
  });

  const [userStats, setUserStats] = useState<UserStats>({
    totalXp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: null,
    completedQuestionsCount: 0,
    completedSessionsCount: 0,
    totalCorrectAnswersCount: 0,
    streakShieldConsumed: false,
  });

  const [isLoading, setIsLoading] = useState(true);

  // Load user stats and today's session progress on initial mount
  const refreshUserStats = useCallback(async () => {
    const stats = await storageRepository.getUserStats();
    setUserStats(stats);
  }, [storageRepository]);

  const initDailySession = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshUserStats();
      const todayStr = getLocalTodayDateString();
      const daily = await storageRepository.getDailySession(todayStr);

      if (daily) {
        if (daily.status === 'REVIEW_VIEWED') {
          setSession({
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
            startTime: null,
            endTime: null,
            fiftyFiftyEliminatedOptions: daily.fiftyFiftyEliminatedOptions || {},
            learnClueRevealed: daily.learnClueRevealed || {},
          });
        } else if (daily.status === 'QUESTIONS_COMPLETED') {
          setSession({
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
            startTime: null,
            endTime: null,
            fiftyFiftyEliminatedOptions: daily.fiftyFiftyEliminatedOptions || {},
            learnClueRevealed: daily.learnClueRevealed || {},
          });
        } else if (daily.status === 'IN_PROGRESS') {
          setSession({
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
            startTime: Date.now(),
            endTime: null,
            fiftyFiftyEliminatedOptions: daily.fiftyFiftyEliminatedOptions || {},
            learnClueRevealed: daily.learnClueRevealed || {},
          });
        }
      } else {
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
          startTime: null,
          endTime: null,
          fiftyFiftyEliminatedOptions: {},
          learnClueRevealed: {},
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [storageRepository, refreshUserStats]);

  useEffect(() => {
    initDailySession();
  }, [initDailySession]);

  /**
   * Starts or resumes today's learning mission.
   * Syncs with Cloud Firestore SessionService if authenticated.
   */
  const startDailySession = useCallback(
    async (count: number = SESSION_CONFIG.DEFAULT_SESSION_LENGTH) => {
      setIsLoading(true);
      try {
        const todayStr = getLocalTodayDateString();
        const existingDaily = await storageRepository.getDailySession(todayStr);

        if (existingDaily) {
          if (existingDaily.status === 'REVIEW_VIEWED' || existingDaily.status === 'QUESTIONS_COMPLETED') {
            return;
          }
          if (existingDaily.status === 'IN_PROGRESS') {
            setSession((prev) => ({
              ...prev,
              status: 'IN_PROGRESS',
              dailyStatus: 'IN_PROGRESS',
            }));
            return;
          }
        }

        const pastSessions = await storageRepository.getAllSessions();
        const sessionQuestions = await questionService.createDailySession(count, pastSessions);
        const newSessionId = `daily_${todayStr}`;

        // Asynchronously initialize Firestore dailySession doc
        const currentUid = defaultAuthService.getSession()?.userId;
        if (currentUid) {
          sessionService.startDailySession(currentUid, todayStr).catch((err) => {
            console.warn('Firestore startDailySession warning:', err);
          });
        }

        const newDailyData: DailySessionData = {
          sessionId: newSessionId,
          date: todayStr,
          status: 'IN_PROGRESS',
          questionsCompleted: false,
          reviewViewed: false,
          currentIndex: 0,
          questions: sessionQuestions,
          history: [],
          score: 0,
          totalQuestions: sessionQuestions.length,
          totalXpEarned: 0,
          correctCount: 0,
          fiftyFiftyEliminatedOptions: {},
          learnClueRevealed: {},
        };

        await storageRepository.saveDailySession(newDailyData);

        setSession({
          status: 'IN_PROGRESS',
          dailyStatus: 'IN_PROGRESS',
          sessionId: newSessionId,
          currentIndex: 0,
          questions: sessionQuestions,
          currentAnswer: null,
          currentEvaluation: null,
          history: [],
          totalXpEarned: 0,
          correctCount: 0,
          questionsCompleted: false,
          reviewViewed: false,
          startTime: Date.now(),
          endTime: null,
          fiftyFiftyEliminatedOptions: {},
          learnClueRevealed: {},
        });
      } finally {
        setIsLoading(false);
      }
    },
    [questionService, storageRepository, sessionService]
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
   * Submits the current question answer for deterministic evaluation.
   * Trainee answers are FINAL. No retry. Writes append-only attempt record to Firestore.
   */
  const submitCurrentAnswer = useCallback(() => {
    setSession((prev) => {
      if (prev.status !== 'IN_PROGRESS' || !prev.currentAnswer) return prev;

      const currentQuestion = prev.questions[prev.currentIndex];
      if (!AnswerEvaluator.isValidAnswer(currentQuestion, prev.currentAnswer)) return prev;

      const evaluation = AnswerEvaluator.evaluate(currentQuestion, prev.currentAnswer);
      const isCorrect = evaluation.is_correct;
      const xpEarned = evaluation.awarded_xp;

      const newHistoryItem = {
        questionId: currentQuestion.question_id,
        question: currentQuestion,
        userAnswer: prev.currentAnswer,
        evaluation: evaluation,
        timestamp: Date.now(),
      };

      // Asynchronously log append-only attempt to Firestore
      const currentUid = defaultAuthService.getSession()?.userId;
      if (currentUid) {
        const powerUpsActive: string[] = [];
        if (prev.fiftyFiftyEliminatedOptions?.[prev.currentIndex]) {
          powerUpsActive.push('FIFTY_FIFTY');
        }
        if (prev.learnClueRevealed?.[prev.currentIndex]) {
          powerUpsActive.push('LEARN');
        }

        sessionService.recordAttempt(currentUid, prev.sessionId || `daily_${getLocalTodayDateString()}`, {
          questionId: currentQuestion.question_id,
          questionIndex: prev.currentIndex,
          userAnswerPayload: prev.currentAnswer,
          result: isCorrect ? 'CORRECT' : 'INCORRECT',
          xpAwarded: xpEarned,
          powerUpsActive,
          isSessionComplete: prev.currentIndex >= prev.questions.length - 1,
        }).catch((err) => {
          console.warn('Firestore recordAttempt warning:', err);
        });
      }

      return {
        ...prev,
        status: 'ANSWER_SUBMITTED',
        currentEvaluation: evaluation,
        history: [...prev.history, newHistoryItem],
        totalXpEarned: prev.totalXpEarned + xpEarned,
        correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      };
    });
  }, [sessionService]);

  /**
   * Activates 50/50 power-up for current MCQ question: eliminates exactly 2 incorrect options.
   * Only usable on MCQ questions. Unlocks at 20-day streak.
   */
  const applyFiftyFifty = useCallback(() => {
    setSession((prev) => {
      if (prev.status !== 'IN_PROGRESS') return prev;
      const currentQ = prev.questions[prev.currentIndex];
      if (!currentQ || currentQ.type !== 'MCQ') return prev;

      const alreadyUsed = Boolean(prev.fiftyFiftyEliminatedOptions?.[prev.currentIndex]);
      const check = PowerUpService.canUseFiftyFifty(userStats, currentQ, alreadyUsed);
      if (!check.canUse) return prev;

      const eliminated = PowerUpService.getEliminatedOptions(currentQ as MCQQuestion);
      const updatedEliminations = {
        ...(prev.fiftyFiftyEliminatedOptions || {}),
        [prev.currentIndex]: eliminated,
      };

      // If user had currently selected an eliminated option, clear selection
      let nextAnswer = prev.currentAnswer;
      if (
        nextAnswer &&
        nextAnswer.type === 'MCQ' &&
        eliminated.includes(nextAnswer.selected_option as any)
      ) {
        nextAnswer = null;
      }

      const updatedSession: SessionState = {
        ...prev,
        fiftyFiftyEliminatedOptions: updatedEliminations,
        currentAnswer: nextAnswer,
      };

      // Persist to daily session in background
      const todayStr = getLocalTodayDateString();
      storageRepository.saveDailySession({
        sessionId: prev.sessionId,
        date: todayStr,
        status: prev.dailyStatus,
        questionsCompleted: prev.questionsCompleted,
        reviewViewed: prev.reviewViewed,
        currentIndex: prev.currentIndex,
        questions: prev.questions,
        history: prev.history,
        score: prev.correctCount,
        totalQuestions: prev.questions.length,
        totalXpEarned: prev.totalXpEarned,
        correctCount: prev.correctCount,
        fiftyFiftyEliminatedOptions: updatedEliminations,
        learnClueRevealed: prev.learnClueRevealed,
      });

      return updatedSession;
    });
  }, [userStats, storageRepository]);

  /**
   * Activates LEARN power-up for current question: reveals clinical learning objective.
   * Unlocks after 100 answered questions.
   */
  const applyLearn = useCallback(() => {
    setSession((prev) => {
      if (prev.status !== 'IN_PROGRESS') return prev;
      const currentQ = prev.questions[prev.currentIndex];
      if (!currentQ) return prev;

      const alreadyUsed = Boolean(prev.learnClueRevealed?.[prev.currentIndex]);
      const check = PowerUpService.canUseLearn(userStats, currentQ, alreadyUsed);
      if (!check.canUse) return prev;

      const updatedRevealed = {
        ...(prev.learnClueRevealed || {}),
        [prev.currentIndex]: true,
      };

      const updatedSession: SessionState = {
        ...prev,
        learnClueRevealed: updatedRevealed,
      };

      // Persist to daily session in background
      const todayStr = getLocalTodayDateString();
      storageRepository.saveDailySession({
        sessionId: prev.sessionId,
        date: todayStr,
        status: prev.dailyStatus,
        questionsCompleted: prev.questionsCompleted,
        reviewViewed: prev.reviewViewed,
        currentIndex: prev.currentIndex,
        questions: prev.questions,
        history: prev.history,
        score: prev.correctCount,
        totalQuestions: prev.questions.length,
        totalXpEarned: prev.totalXpEarned,
        correctCount: prev.correctCount,
        fiftyFiftyEliminatedOptions: prev.fiftyFiftyEliminatedOptions,
        learnClueRevealed: updatedRevealed,
      });

      return updatedSession;
    });
  }, [userStats, storageRepository]);

  /**
   * Advances to the next question or completes the session.
   * Session contains exactly 10 questions. Finalizes daily session in Firestore.
   */
  const nextQuestion = useCallback(async () => {
    setSession((prev) => {
      if (prev.status !== 'ANSWER_SUBMITTED') return prev;

      const nextIndex = prev.currentIndex + 1;
      const isFinished = nextIndex >= prev.questions.length;
      const todayStr = getLocalTodayDateString();

      if (isFinished) {
        const bonusXp = SESSION_CONFIG.XP_REWARDS.SESSION_COMPLETION_BONUS;
        const finalXp = prev.totalXpEarned + bonusXp;

        const storedRecord: StoredSessionRecord = {
          sessionId: prev.sessionId,
          timestamp: Date.now(),
          totalQuestions: prev.questions.length,
          correctCount: prev.correctCount,
          xpEarned: finalXp,
          date: todayStr,
          answers: prev.history.map((h) => ({
            questionId: h.questionId,
            isCorrect: h.evaluation.is_correct,
            userAnswer: h.userAnswer!,
            category: h.question.category,
          })),
        };

        const completedDaily: DailySessionData = {
          sessionId: prev.sessionId,
          date: todayStr,
          status: 'QUESTIONS_COMPLETED',
          questionsCompleted: true,
          reviewViewed: false,
          currentIndex: prev.questions.length,
          questions: prev.questions,
          history: prev.history,
          score: prev.correctCount,
          totalQuestions: prev.questions.length,
          totalXpEarned: finalXp,
          correctCount: prev.correctCount,
          fiftyFiftyEliminatedOptions: prev.fiftyFiftyEliminatedOptions,
          learnClueRevealed: prev.learnClueRevealed,
        };

        // Asynchronously finalize Cloud Firestore dailySession & user progression
        const currentUid = defaultAuthService.getSession()?.userId;
        if (currentUid) {
          sessionService.finalizeSession(
            currentUid,
            prev.sessionId,
            finalXp,
            prev.correctCount,
            prev.questions.length
          ).catch((err) => {
            console.warn('Firestore finalizeSession warning:', err);
          });
        }

        // Persist session locally
        Promise.all([
          storageRepository.saveSession(storedRecord),
          storageRepository.saveDailySession(completedDaily),
        ]).then(() => {
          refreshUserStats();
        });

        return {
          ...prev,
          status: 'COMPLETED',
          dailyStatus: 'QUESTIONS_COMPLETED',
          questionsCompleted: true,
          reviewViewed: false,
          totalXpEarned: finalXp,
          endTime: Date.now(),
          currentAnswer: null,
          currentEvaluation: null,
        };
      }

      const progressDaily: DailySessionData = {
        sessionId: prev.sessionId,
        date: todayStr,
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        reviewViewed: false,
        currentIndex: nextIndex,
        questions: prev.questions,
        history: prev.history,
        score: prev.correctCount,
        totalQuestions: prev.questions.length,
        totalXpEarned: prev.totalXpEarned,
        correctCount: prev.correctCount,
        fiftyFiftyEliminatedOptions: prev.fiftyFiftyEliminatedOptions,
        learnClueRevealed: prev.learnClueRevealed,
      };

      storageRepository.saveDailySession(progressDaily);

      return {
        ...prev,
        status: 'IN_PROGRESS',
        dailyStatus: 'IN_PROGRESS',
        currentIndex: nextIndex,
        currentAnswer: null,
        currentEvaluation: null,
      };
    });
  }, [storageRepository, refreshUserStats, sessionService]);

  /**
   * Marks session review as viewed and locks today's session.
   */
  const markReviewViewed = useCallback(async () => {
    const todayStr = getLocalTodayDateString();
    setSession((prev) => {
      const finishedDaily: DailySessionData = {
        sessionId: prev.sessionId || `daily_${todayStr}`,
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
        fiftyFiftyEliminatedOptions: prev.fiftyFiftyEliminatedOptions,
        learnClueRevealed: prev.learnClueRevealed,
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

  const currentQuestion: Question | null =
    session.questions.length > 0 && session.currentIndex < session.questions.length
      ? session.questions[session.currentIndex]
      : null;

  return {
    session,
    userStats,
    isLoading,
    currentQuestion,
    startDailySession,
    setAnswer,
    submitCurrentAnswer,
    applyFiftyFifty,
    applyLearn,
    nextQuestion,
    markReviewViewed,
    refreshUserStats,
  };
}
