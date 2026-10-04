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

export function useLearningSession(
  questionService: QuestionService = defaultQuestionService,
  storageRepository: StorageRepository = defaultStorageRepository
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
    hintEliminatedOptions: {},
    learnClueRevealed: {},
    retryUsed: {},
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
            hintEliminatedOptions: daily.hintEliminatedOptions || {},
            learnClueRevealed: daily.learnClueRevealed || {},
            retryUsed: daily.retryUsed || {},
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
            hintEliminatedOptions: daily.hintEliminatedOptions || {},
            learnClueRevealed: daily.learnClueRevealed || {},
            retryUsed: daily.retryUsed || {},
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
            hintEliminatedOptions: daily.hintEliminatedOptions || {},
            learnClueRevealed: daily.learnClueRevealed || {},
            retryUsed: daily.retryUsed || {},
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
          hintEliminatedOptions: {},
          learnClueRevealed: {},
          retryUsed: {},
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
          hintEliminatedOptions: {},
          learnClueRevealed: {},
          retryUsed: {},
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
          hintEliminatedOptions: {},
          learnClueRevealed: {},
          retryUsed: {},
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
   * Submits the current question answer for deterministic evaluation.
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

      return {
        ...prev,
        status: 'ANSWER_SUBMITTED',
        currentEvaluation: evaluation,
        history: [...prev.history, newHistoryItem],
        totalXpEarned: prev.totalXpEarned + xpEarned,
        correctCount: isCorrect ? prev.correctCount + 1 : prev.correctCount,
      };
    });
  }, []);

  /**
   * Activates HINT power-up for the current question: eliminates 2 incorrect options.
   */
  const applyHint = useCallback(() => {
    setSession((prev) => {
      if (prev.status !== 'IN_PROGRESS') return prev;
      const currentQ = prev.questions[prev.currentIndex];
      if (!currentQ || currentQ.type !== 'MCQ') return prev;

      const alreadyUsed = Boolean(prev.hintEliminatedOptions?.[prev.currentIndex]);
      const check = PowerUpService.canUseHint(userStats, currentQ, alreadyUsed);
      if (!check.canUse) return prev;

      const eliminated = PowerUpService.getEliminatedOptions(currentQ as MCQQuestion);
      const updatedEliminations = {
        ...(prev.hintEliminatedOptions || {}),
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
        hintEliminatedOptions: updatedEliminations,
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
        hintEliminatedOptions: updatedEliminations,
        learnClueRevealed: prev.learnClueRevealed,
        retryUsed: prev.retryUsed,
      });

      return updatedSession;
    });
  }, [userStats, storageRepository]);

  /**
   * Activates LEARN power-up for current question: reveals clinical learning clue.
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
        hintEliminatedOptions: prev.hintEliminatedOptions,
        learnClueRevealed: updatedRevealed,
        retryUsed: prev.retryUsed,
      });

      return updatedSession;
    });
  }, [userStats, storageRepository]);

  /**
   * Activates RETRY power-up after an incorrect answer: allows 1 re-attempt on the same question.
   */
  const applyRetry = useCallback(() => {
    setSession((prev) => {
      if (prev.status !== 'ANSWER_SUBMITTED') return prev;
      const isCorrect = Boolean(prev.currentEvaluation?.is_correct);
      const alreadyUsed = Boolean(prev.retryUsed?.[prev.currentIndex]);

      const check = PowerUpService.canUseRetry(userStats, true, isCorrect, alreadyUsed);
      if (!check.canUse) return prev;

      const updatedRetries = {
        ...(prev.retryUsed || {}),
        [prev.currentIndex]: true,
      };

      // Remove the incorrect answer attempt from history so the re-attempt replaces it
      const updatedHistory = prev.history.slice(0, prev.currentIndex);

      const updatedSession: SessionState = {
        ...prev,
        status: 'IN_PROGRESS',
        currentAnswer: null,
        currentEvaluation: null,
        history: updatedHistory,
        retryUsed: updatedRetries,
      };

      // Persist to daily session in background
      const todayStr = getLocalTodayDateString();
      storageRepository.saveDailySession({
        sessionId: prev.sessionId,
        date: todayStr,
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        reviewViewed: false,
        currentIndex: prev.currentIndex,
        questions: prev.questions,
        history: updatedHistory,
        score: prev.correctCount,
        totalQuestions: prev.questions.length,
        totalXpEarned: prev.totalXpEarned,
        correctCount: prev.correctCount,
        hintEliminatedOptions: prev.hintEliminatedOptions,
        learnClueRevealed: prev.learnClueRevealed,
        retryUsed: updatedRetries,
      });

      return updatedSession;
    });
  }, [userStats, storageRepository]);

  /**
   * Advances to the next question or completes the session.
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
          hintEliminatedOptions: prev.hintEliminatedOptions,
          learnClueRevealed: prev.learnClueRevealed,
          retryUsed: prev.retryUsed,
        };

        // Persist session asynchronously
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
        hintEliminatedOptions: prev.hintEliminatedOptions,
        learnClueRevealed: prev.learnClueRevealed,
        retryUsed: prev.retryUsed,
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
  }, [storageRepository, refreshUserStats]);

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
        hintEliminatedOptions: prev.hintEliminatedOptions,
        learnClueRevealed: prev.learnClueRevealed,
        retryUsed: prev.retryUsed,
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
    applyHint,
    applyLearn,
    applyRetry,
    nextQuestion,
    markReviewViewed,
    refreshUserStats,
  };
}
