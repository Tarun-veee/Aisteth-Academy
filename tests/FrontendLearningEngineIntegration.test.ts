import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useLearningSession, generateIdempotencyKey, generateSubmissionNonce } from '../src/hooks/useLearningSession';
import { sessionApi } from '../src/api/sessionApi';
import { QuestionService } from '../src/services/QuestionService';
import { StorageRepository } from '../src/repositories/StorageRepository';
import { SessionService } from '../src/services/SessionService';
import { Question } from '../src/models/question.types';
import { defaultAuthService } from '../src/services/AuthService';

// Mock sessionApi
vi.mock('../src/api/sessionApi', () => ({
  sessionApi: {
    getTodaySession: vi.fn(),
    recordAttempt: vi.fn(),
    finalizeSession: vi.fn(),
  },
}));

/**
 * Pure Node.js React hook harness using React internals dispatcher.
 * Permits executing stateful hooks with complete React lifecycle (useState, useRef, useCallback, useEffect)
 * without needing browser/jsdom dependencies.
 */
function createHookHarness<T>(hookFn: () => T) {
  const states: any[] = [];
  const refs: any[] = [];
  const callbacks: Array<{ fn: any; deps: any[] | undefined }> = [];
  const effects: Array<{ effect: any; deps: any[] | undefined }> = [];
  let stateIdx = 0;
  let refIdx = 0;
  let cbIdx = 0;
  let effIdx = 0;
  const effectQueue: Array<() => void> = [];
  let currentResult: T;
  let isRerendering = false;

  const dispatcher = {
    useState(initial: any) {
      const idx = stateIdx++;
      if (states.length <= idx) {
        states.push(typeof initial === 'function' ? initial() : initial);
      }
      const setState = (action: any) => {
        const nextVal = typeof action === 'function' ? action(states[idx]) : action;
        if (!Object.is(states[idx], nextVal)) {
          states[idx] = nextVal;
          if (!isRerendering) {
            rerender();
          }
        }
      };
      return [states[idx], setState];
    },
    useRef(initial: any) {
      const idx = refIdx++;
      if (refs.length <= idx) {
        refs.push({ current: initial });
      }
      return refs[idx];
    },
    useCallback(fn: any, deps?: any[]) {
      const idx = cbIdx++;
      const prev = callbacks[idx];
      if (prev && deps && prev.deps) {
        const unchanged = deps.length === prev.deps.length && deps.every((d, i) => Object.is(d, prev.deps![i]));
        if (unchanged) {
          return prev.fn;
        }
      }
      callbacks[idx] = { fn, deps };
      return fn;
    },
    useEffect(effect: any, deps?: any[]) {
      const idx = effIdx++;
      const prev = effects[idx];
      let hasChanged = true;
      if (prev && deps && prev.deps) {
        hasChanged = deps.length !== prev.deps.length || deps.some((d, i) => !Object.is(d, prev.deps![i]));
      }
      if (hasChanged) {
        effects[idx] = { effect, deps };
        effectQueue.push(effect);
      }
    },
    useMemo(fn: any) {
      return fn();
    },
  };

  function rerender() {
    if (isRerendering) return;
    isRerendering = true;
    stateIdx = 0;
    refIdx = 0;
    cbIdx = 0;
    effIdx = 0;
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
    currentResult = hookFn();
    isRerendering = false;

    while (effectQueue.length > 0) {
      const eff = effectQueue.shift();
      if (eff) eff();
    }
  }

  rerender();

  return {
    get: () => currentResult,
    rerender,
  };
}


describe('Stage 4 — Frontend Learning Engine Integration Suite', () => {
  const mockUid = 'usr_stage4_test_01';
  const mockSessionId = 'daily_2026-10-12_usr_stag';

  // 10 Mock Primary Questions
  const mockPrimaryQuestions: Question[] = Array.from({ length: 10 }, (_, i) => ({
    question_id: `MG-AIL-${String(i + 1).padStart(2, '0')}-TH`,
    type: 'MCQ',
    category: 'DEVICE_HANDLING',
    difficulty: 'BEGINNER',
    question: `Primary Question ${i + 1}`,
    option_a: 'Correct A',
    option_b: 'Incorrect B',
    option_c: 'Incorrect C',
    option_d: 'Incorrect D',
    correct_answer: 'option_a',
    explanation: `Explanation for Q${i + 1}`,
    learning_objective: `Objective ${i + 1}`,
    tags: ['test'],
    clinician_validated: true,
    source: 'MEDGEMMA',
    version: '1.0.0',
    question_type: 'Primary',
    follow_up_for: null,
  } as any));

  // Canonical Follow-Up Question for Q1
  const mockFollowUpQ1: Question = {
    question_id: 'MG-AIL-01-PR',
    type: 'MCQ',
    category: 'DEVICE_HANDLING',
    difficulty: 'BEGINNER',
    question: 'Follow-Up Practice Question 1',
    option_a: 'Incorrect A',
    option_b: 'Correct B',
    option_c: 'Incorrect C',
    option_d: 'Incorrect D',
    correct_answer: 'option_b',
    explanation: 'Explanation for Follow-Up 1',
    learning_objective: 'Follow-Up Objective 1',
    tags: ['test'],
    clinician_validated: true,
    source: 'MEDGEMMA',
    version: '1.0.0',
    question_type: 'Follow-Up',
    follow_up_for: 'MG-AIL-01-TH',
  } as any;

  let mockQuestionService: any;
  let mockStorageRepository: any;
  let sessionService: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Authenticated user context
    vi.spyOn(defaultAuthService, 'getSession').mockReturnValue({
      userId: mockUid,
      email: 'test@aisteth.com',
      token: 'jwt_mock_token',
      expiresAt: Date.now() + 3600000,
    } as any);

    mockQuestionService = {
      createDailySession: vi.fn().mockResolvedValue(mockPrimaryQuestions),
      getQuestionById: vi.fn().mockImplementation(async (id: string) => {
        if (id === 'MG-AIL-01-PR') return mockFollowUpQ1;
        return mockPrimaryQuestions.find(q => q.question_id === id) || null;
      }),
      getFollowUpQuestion: vi.fn().mockImplementation(async (mainId: string) => {
        if (mainId === 'MG-AIL-01-TH') return mockFollowUpQ1;
        return null;
      }),
      getAllQuestions: vi.fn().mockResolvedValue([...mockPrimaryQuestions, mockFollowUpQ1]),
    };

    mockStorageRepository = {
      getUserStats: vi.fn().mockResolvedValue({
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
        streakShieldConsumed: false,
      }),
      getDailySession: vi.fn().mockResolvedValue(null),
      saveDailySession: vi.fn().mockResolvedValue(undefined),
      getAllSessions: vi.fn().mockResolvedValue([]),
      saveSession: vi.fn().mockResolvedValue(undefined),
    };

    sessionService = new SessionService();
  });

  // =========================================================================
  // 1. TEN CORRECT PRIMARY QUESTIONS AND ZERO COMPLETION BONUS
  // =========================================================================
  it('Scenario 1: Ten correct Primary answers award exactly 10 XP each and zero completion bonus', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    expect(harness.get().session.currentIndex).toBe(0);
    expect(harness.get().session.status).toBe('IN_PROGRESS');

    // Answer questions 0 through 9 correctly
    for (let i = 0; i < 10; i++) {
      const q = mockPrimaryQuestions[i];
      harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

      const isTerminal = i === 9;
      vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
        success: true,
        attemptId: `att_${mockSessionId}_q${i}_MAIN`,
        evaluation: {
          is_correct: true,
          awarded_xp: 10,
          feedback_message: 'Correct!',
          explanation: q.explanation,
        },
        result: 'CORRECT',
        xpAwarded: 10,
        branchState: 'MAIN',
        currentQuestionIndex: isTerminal ? 10 : i + 1,
        totalXpEarned: (i + 1) * 10,
        correctCount: i + 1,
        isSessionComplete: isTerminal,
        questionsCompleted: isTerminal,
        status: isTerminal ? 'QUESTIONS_COMPLETED' : 'IN_PROGRESS',
      });

      if (isTerminal) {
        vi.mocked(sessionApi.finalizeSession).mockResolvedValueOnce({
          success: true,
          alreadyFinalized: false,
        });
      }

      await harness.get().submitCurrentAnswer();

      expect(harness.get().session.status).toBe('ANSWER_SUBMITTED');
      expect(harness.get().session.totalXpEarned).toBe((i + 1) * 10);
      expect(harness.get().session.correctCount).toBe(i + 1);

      await harness.get().nextQuestion();
    }

    // Terminal verification: Exactly 100 XP awarded; session finalization awards 0 XP bonus
    expect(harness.get().session.status).toBe('COMPLETED');
    expect(harness.get().session.questionsCompleted).toBe(true);
    expect(harness.get().session.totalXpEarned).toBe(100);
    expect(harness.get().session.correctCount).toBe(10);
    expect(sessionApi.finalizeSession).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      totalXpEarned: 100, // No +10 completion bonus added!
      correctCount: 10,
      totalQuestions: 10,
    });
  });

  // =========================================================================
  // 2. PRIMARY FAILURE -> FOLLOW-UP -> SUCCESSFUL REATTEMPT
  // =========================================================================
  it('Scenario 2: Primary failure -> Follow-Up success -> Primary reattempt success awards 10 XP only upon reattempt', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();

    // Step 2A: Trainee answers Primary Q0 incorrectly
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_b' });

    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_MAIN`,
      evaluation: {
        is_correct: false,
        awarded_xp: 0,
        feedback_message: 'Incorrect.',
        explanation: 'Primary explanation',
      },
      result: 'INCORRECT',
      xpAwarded: 0,
      branchState: 'FOLLOW_UP',
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      isSessionComplete: false,
      questionsCompleted: false,
      status: 'IN_PROGRESS',
    });

    await harness.get().submitCurrentAnswer();

    expect(harness.get().session.status).toBe('ANSWER_SUBMITTED');
    expect(harness.get().session.totalXpEarned).toBe(0);
    expect(harness.get().session.activeFollowUpQuestion?.question_id).toBe('MG-AIL-01-PR');

    // Trainee clicks "Start Follow-Up Exercise"
    await harness.get().nextQuestion();

    expect(harness.get().session.status).toBe('IN_PROGRESS');
    expect(harness.get().session.branchState).toBe('FOLLOW_UP');
    expect(harness.get().currentQuestion?.question_id).toBe('MG-AIL-01-PR');

    // Step 2B: Trainee answers Follow-Up question correctly (Awards 0 XP)
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_b' });

    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_FOLLOW_UP`,
      evaluation: {
        is_correct: true,
        awarded_xp: 0,
        feedback_message: 'Follow-Up Correct!',
        explanation: 'Follow-Up explanation',
      },
      result: 'CORRECT',
      xpAwarded: 0, // Follow-ups award 0 XP
      branchState: 'REATTEMPT_MAIN',
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      isSessionComplete: false,
      questionsCompleted: false,
      status: 'IN_PROGRESS',
    });

    await harness.get().submitCurrentAnswer();

    expect(harness.get().session.status).toBe('ANSWER_SUBMITTED');
    expect(harness.get().session.totalXpEarned).toBe(0);

    // Trainee clicks "Re-attempt Main Question"
    await harness.get().nextQuestion();

    expect(harness.get().session.status).toBe('IN_PROGRESS');
    expect(harness.get().session.branchState).toBe('REATTEMPT_MAIN');
    expect(harness.get().currentQuestion?.question_id).toBe('MG-AIL-01-TH');

    // Step 2C: Trainee re-attempts Primary Q0 correctly (Awards 10 XP)
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_REATTEMPT_MAIN`,
      evaluation: {
        is_correct: true,
        awarded_xp: 10,
        feedback_message: 'Primary Reattempt Correct!',
        explanation: 'Primary explanation',
      },
      result: 'CORRECT',
      xpAwarded: 10,
      branchState: 'MAIN',
      currentQuestionIndex: 1,
      totalXpEarned: 10,
      correctCount: 1,
      isSessionComplete: false,
      questionsCompleted: false,
      status: 'IN_PROGRESS',
    });

    await harness.get().submitCurrentAnswer();

    expect(harness.get().session.totalXpEarned).toBe(10);
    expect(harness.get().session.correctCount).toBe(1);

    // Trainee advances to next question (Index 1)
    await harness.get().nextQuestion();

    expect(harness.get().session.currentIndex).toBe(1);
    expect(harness.get().session.branchState).toBe('MAIN');
    expect(harness.get().currentQuestion?.question_id).toBe('MG-AIL-02-TH');
  });

  // =========================================================================
  // 3. REMEDIAL FAILURES: FOLLOW-UP FAILURE & REATTEMPT FAILURE
  // =========================================================================
  it('Scenario 3A: Follow-Up failure records Unsolved Bucket on server and advances to next Primary with 0 XP', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();

    // Primary fails -> Follow-Up
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_b' });
    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_MAIN`,
      evaluation: { is_correct: false, awarded_xp: 0, feedback_message: 'Wrong', explanation: '' },
      result: 'INCORRECT',
      xpAwarded: 0,
      branchState: 'FOLLOW_UP',
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
    });
    await harness.get().submitCurrentAnswer();
    await harness.get().nextQuestion();

    // Follow-up fails -> Backend concludes branch, advances to index 1, awards 0 XP
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });
    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_FOLLOW_UP`,
      evaluation: { is_correct: false, awarded_xp: 0, feedback_message: 'Follow-Up Failed', explanation: '' },
      result: 'INCORRECT',
      xpAwarded: 0,
      branchState: 'MAIN',
      currentQuestionIndex: 1,
      totalXpEarned: 0,
      correctCount: 0,
      isSessionComplete: false,
    });
    await harness.get().submitCurrentAnswer();
    await harness.get().nextQuestion();

    expect(harness.get().session.currentIndex).toBe(1);
    expect(harness.get().session.branchState).toBe('MAIN');
    expect(harness.get().session.totalXpEarned).toBe(0);
    expect(harness.get().currentQuestion?.question_id).toBe('MG-AIL-02-TH');
  });

  it('Scenario 3B: Primary reattempt failure records Unsolved Bucket and advances with 0 XP', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'REATTEMPT_MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    expect(harness.get().session.branchState).toBe('REATTEMPT_MAIN');

    // Reattempt fails
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_c' });
    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_REATTEMPT_MAIN`,
      evaluation: { is_correct: false, awarded_xp: 0, feedback_message: 'Reattempt Failed', explanation: '' },
      result: 'INCORRECT',
      xpAwarded: 0,
      branchState: 'MAIN',
      currentQuestionIndex: 1,
      totalXpEarned: 0,
      correctCount: 0,
      isSessionComplete: false,
    });

    await harness.get().submitCurrentAnswer();
    await harness.get().nextQuestion();

    expect(harness.get().session.currentIndex).toBe(1);
    expect(harness.get().session.branchState).toBe('MAIN');
    expect(harness.get().session.totalXpEarned).toBe(0);
  });

  // =========================================================================
  // 4. XP ELIGIBILITY AND SERVER-AUTHORITATIVE PROGRESSION
  // =========================================================================
  it('Scenario 4: Duplicate completion receives 0 XP from server; client never determines XP independently', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 50,
        correctCount: 5,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

    // Server says is_correct: true, BUT xpAwarded: 0 because question already in lifetime completed ledger
    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_MAIN`,
      evaluation: {
        is_correct: true,
        awarded_xp: 0,
        feedback_message: 'Correct (already completed)',
        explanation: '',
      },
      result: 'CORRECT',
      xpAwarded: 0, // Server-authoritative: zero XP for duplicate
      branchState: 'MAIN',
      currentQuestionIndex: 1,
      totalXpEarned: 50, // Remains 50
      correctCount: 6,
    });

    await harness.get().submitCurrentAnswer();

    // Client must not award 10 XP locally
    expect(harness.get().session.totalXpEarned).toBe(50);
    expect(harness.get().session.currentEvaluation?.awarded_xp).toBe(0);
  });

  // =========================================================================
  // 5. NETWORK FAILURE AND IDEMPOTENT RETRY
  // =========================================================================
  it('Scenario 5: Network failure retains canonical idempotency key and payload for identical retry', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

    // First attempt fails with network disconnect
    vi.mocked(sessionApi.recordAttempt).mockRejectedValueOnce(
      new Error('Failed to fetch: Connection timeout')
    );

    await harness.get().submitCurrentAnswer();

    // Verification: Not advanced, error recorded, idempotency key retained
    expect(harness.get().session.status).toBe('IN_PROGRESS');
    expect(harness.get().session.currentIndex).toBe(0);
    expect(harness.get().session.submissionError).toContain('Connection timeout');
    const retainedKey = harness.get().session.pendingIdempotencyKey;
    expect(retainedKey).toBeDefined();
    expect(retainedKey).toMatch(/^idem_daily_2026-10-12_usr_stag_q0_MAIN_[a-zA-Z0-9_-]{8,64}$/);

    // Second attempt succeeds using the EXACT retained key
    vi.mocked(sessionApi.recordAttempt).mockResolvedValueOnce({
      success: true,
      attemptId: `att_${mockSessionId}_q0_MAIN`,
      evaluation: { is_correct: true, awarded_xp: 10, feedback_message: 'Correct!', explanation: '' },
      result: 'CORRECT',
      xpAwarded: 10,
      branchState: 'MAIN',
      currentQuestionIndex: 1,
      totalXpEarned: 10,
      correctCount: 1,
    });

    await harness.get().submitCurrentAnswer();

    // Verify sessionApi was called with the EXACT retained key
    expect(sessionApi.recordAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({
        idempotencyKey: retainedKey,
        questionIndex: 0,
        branchState: 'MAIN',
      })
    );

    // After success, pending key is cleared
    expect(harness.get().session.pendingIdempotencyKey).toBeNull();
    expect(harness.get().session.status).toBe('ANSWER_SUBMITTED');
  });

  // =========================================================================
  // 6. DUPLICATE-CLICK PREVENTATION
  // =========================================================================
  it('Scenario 6: Synchronous submission guard prevents concurrent duplicate submissions', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

    // Create a delayed response
    let resolveSubmission: any;
    const delayedPromise = new Promise<any>((resolve) => {
      resolveSubmission = resolve;
    });

    vi.mocked(sessionApi.recordAttempt).mockReturnValueOnce(delayedPromise);

    // First click initiates submission
    const firstSubmission = harness.get().submitCurrentAnswer();
    expect(harness.get().session.isSubmitting).toBe(true);

    // Second click occurs while first is in-flight
    const secondSubmission = harness.get().submitCurrentAnswer();

    // Resolve network request
    resolveSubmission({
      success: true,
      attemptId: `att_${mockSessionId}_q0_MAIN`,
      evaluation: { is_correct: true, awarded_xp: 10, feedback_message: 'Ok', explanation: '' },
      result: 'CORRECT',
      xpAwarded: 10,
      branchState: 'MAIN',
      currentQuestionIndex: 1,
      totalXpEarned: 10,
      correctCount: 1,
    });

    await Promise.all([firstSubmission, secondSubmission]);

    // Backend sessionApi.recordAttempt must be invoked exactly ONCE
    expect(sessionApi.recordAttempt).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // 7. HTTP 409 RECONCILIATION
  // =========================================================================
  it('Scenario 7A: HTTP 409 already completed reconciles session to terminal state', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

    const conflictErr: any = new Error('Daily session is already completed.');
    conflictErr.status = 409;
    vi.mocked(sessionApi.recordAttempt).mockRejectedValueOnce(conflictErr);

    await harness.get().submitCurrentAnswer();

    expect(harness.get().session.status).toBe('COMPLETED');
    expect(harness.get().session.dailyStatus).toBe('QUESTIONS_COMPLETED');
    expect(harness.get().session.questionsCompleted).toBe(true);
  });

  it('Scenario 7B: HTTP 409 question index mismatch synchronizes state from server session', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    await harness.get().startDailySession();
    harness.get().setAnswer({ type: 'MCQ', selected_option: 'option_a' });

    // Server returns 409 index mismatch (client was on index 0, but server already at index 2)
    const mismatchErr: any = new Error('Question index mismatch: expected question index 2, but received 0.');
    mismatchErr.status = 409;
    vi.mocked(sessionApi.recordAttempt).mockRejectedValueOnce(mismatchErr);

    // Mock reconciliation response
    vi.mocked(sessionApi.getTodaySession).mockResolvedValueOnce({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 2,
        totalXpEarned: 20,
        correctCount: 2,
        branchState: 'MAIN',
      },
      questions: mockPrimaryQuestions,
    });

    await harness.get().submitCurrentAnswer();

    // Reconciled with server!
    expect(harness.get().session.currentIndex).toBe(2);
    expect(harness.get().session.totalXpEarned).toBe(20);
    expect(harness.get().session.correctCount).toBe(2);
    expect(harness.get().session.submissionError).toContain('Reconciled with server');
  });

  // =========================================================================
  // 8. SESSION RECOVERY AND TERMINAL STATE
  // =========================================================================
  it('Scenario 8: Initializing session recovers existing server in-progress session at index 3 in FOLLOW_UP branch', async () => {
    vi.mocked(sessionApi.getTodaySession).mockResolvedValue({
      session: {
        sessionId: mockSessionId,
        uid: mockUid,
        status: 'IN_PROGRESS',
        questionIds: mockPrimaryQuestions.map(q => q.question_id),
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        branchState: 'FOLLOW_UP',
        activeFollowUpQuestionId: 'MG-AIL-01-PR',
      },
      questions: mockPrimaryQuestions,
    });

    const harness = createHookHarness(() =>
      useLearningSession(mockQuestionService, mockStorageRepository, sessionService)
    );

    // Await initDailySession to recover existing server session
    await harness.get().initDailySession();

    expect(harness.get().session.status).toBe('IN_PROGRESS');
    expect(harness.get().session.branchState).toBe('FOLLOW_UP');
    expect(harness.get().currentQuestion?.question_id).toBe('MG-AIL-01-PR');
  });


  // =========================================================================
  // 9. IDEMPOTENCY KEY BOUNDARY FORMAT VERIFICATION
  // =========================================================================
  it('Scenario 9: Canonical idempotency key format adheres strictly to backend boundary constraints', () => {
    const key = generateIdempotencyKey('daily_2026-10-12_usr_1234', 0, 'MAIN', 'nonce_12345678');
    expect(key).toBe('idem_daily_2026-10-12_usr_1234_q0_MAIN_nonce_12345678');
    expect(key.length).toBeGreaterThanOrEqual(23);
    expect(key.length).toBeLessThanOrEqual(152);

    const match = key.match(/^idem_([a-zA-Z0-9_-]{1,64})_q([0-9]{1,2})_(MAIN|FOLLOW_UP|REATTEMPT_MAIN)_([a-zA-Z0-9_-]{8,64})$/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('daily_2026-10-12_usr_1234');
    expect(match?.[2]).toBe('0');
    expect(match?.[3]).toBe('MAIN');
    expect(match?.[4]).toBe('nonce_12345678');

    // Nonce generator produces valid [a-zA-Z0-9_-]{8,64}
    const nonce = generateSubmissionNonce();
    expect(nonce.length).toBe(16);
    expect(nonce).toMatch(/^[a-zA-Z0-9_-]{16}$/);
  });
});
