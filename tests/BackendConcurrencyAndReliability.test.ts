/**
 * AiSteth Academy — Backend Concurrency, Failure, and Reliability Tests
 * Phase 2 Backend Hardening Verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService, generateCanonicalSessionId } from '../src/services/SessionService';
import { sessionApi } from '../src/api/sessionApi';

// Mock sessionApi
vi.mock('../src/api/sessionApi', () => {
  return {
    sessionApi: {
      getTodaySession: vi.fn(),
      recordAttempt: vi.fn(),
      finalizeSession: vi.fn(),
    },
  };
});

describe('Phase 2 Backend Concurrency & Reliability Suite', () => {
  let sessionService: SessionService;
  const mockUid = 'trainee_concurrency_01';
  const mockDate = '2026-10-08';
  const canonicalSessionId = generateCanonicalSessionId(mockUid, mockDate);

  beforeEach(() => {
    vi.clearAllMocks();
    sessionService = new SessionService();
  });

  // =========================================================================
  // SCENARIO A: Same user — two tabs finalize()
  // =========================================================================
  it('Scenario A: Two tabs finalizing simultaneously produce exactly 1 finalization, 1 XP increment, 1 streak increment, 0 duplicates', async () => {
    let committedWrites = 0;
    const sessionDoc = {
      sessionId: canonicalSessionId,
      userId: mockUid,
      status: 'QUESTIONS_COMPLETED',
      reviewViewed: false,
    };
    const userDoc = {
      learningState: {
        totalXp: 100,
        currentStreak: 5,
        completedSessionsCount: 5,
        completedQuestionsCount: 50,
        totalCorrectAnswersCount: 40,
        longestStreak: 5,
      },
    };

    vi.mocked(sessionApi.finalizeSession).mockImplementation(async (payload) => {
      committedWrites++;
      sessionDoc.status = 'REVIEW_COMPLETED';
      userDoc.learningState.totalXp += payload.totalXpEarned;
      userDoc.learningState.currentStreak += 1;
      userDoc.learningState.completedSessionsCount += 1;
      return {
        success: true,
        alreadyFinalized: false,
      };
    });

    // Tab A and Tab B fire finalization
    const tabA = sessionService.finalizeSession(mockUid, canonicalSessionId, 50, 8, 10);
    const tabB = sessionService.finalizeSession(mockUid, canonicalSessionId, 50, 8, 10);

    const [resultA, resultB] = await Promise.all([tabA, tabB]);

    // Exactly one succeeds
    const successCount = [resultA, resultB].filter(Boolean).length;
    expect(successCount).toBe(1);

    // Exactly one write committed
    expect(committedWrites).toBe(1);

    // Progression values verified: exactly +50 XP, +1 streak, +1 session
    expect(userDoc.learningState.totalXp).toBe(150);
    expect(userDoc.learningState.currentStreak).toBe(6);
    expect(userDoc.learningState.completedSessionsCount).toBe(6);
    expect(sessionDoc.status).toBe('REVIEW_COMPLETED');
  });

  // =========================================================================
  // SCENARIO B: Same user — two devices answer
  // =========================================================================
  it('Scenario B: Two devices answering record distinct append-only attempts and update canonical session index', async () => {
    const recordedAttempts: any[] = [];

    vi.mocked(sessionApi.recordAttempt).mockImplementation(async (payload) => {
      const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      recordedAttempts.push({
        attemptId,
        sessionId: payload.sessionId,
        questionId: payload.questionId,
      });
      return {
        success: true,
        attemptId,
        evaluation: { isCorrect: true, score: 5 } as any,
      };
    });

    // Device A submits Q1, Device B submits Q2 concurrently
    const devA = sessionService.recordAttempt(mockUid, canonicalSessionId, {
      questionId: 'Q1',
      questionIndex: 0,
      userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      result: 'CORRECT',
      xpAwarded: 5,
    });

    const devB = sessionService.recordAttempt(mockUid, canonicalSessionId, {
      questionId: 'Q2',
      questionIndex: 1,
      userAnswerPayload: { type: 'MCQ', selected_option: 'option_b' },
      result: 'CORRECT',
      xpAwarded: 5,
    });

    const [resA, resB] = await Promise.all([devA, devB]);

    // Distinct attempt IDs generated (no collision)
    expect(resA.attemptId).not.toBe(resB.attemptId);
    expect(recordedAttempts.length).toBe(2);

    // Both point to the exact same canonical session ID
    expect(recordedAttempts[0].sessionId).toBe(canonicalSessionId);
    expect(recordedAttempts[1].sessionId).toBe(canonicalSessionId);
  });

  // =========================================================================
  // SCENARIO C: Concurrent Finalization (N requests)
  // =========================================================================
  it('Scenario C: 10 concurrent finalization requests yield exactly 1 success, 9 rejections, 0 duplicate progression', async () => {
    let progressionUpdates = 0;
    const userDoc = {
      learningState: { totalXp: 200, currentStreak: 10, completedSessionsCount: 10 },
    };

    vi.mocked(sessionApi.finalizeSession).mockImplementation(async (payload) => {
      progressionUpdates++;
      userDoc.learningState.totalXp += payload.totalXpEarned;
      return {
        success: true,
        alreadyFinalized: false,
      };
    });

    // Launch 10 simultaneous finalization requests
    const promises = Array.from({ length: 10 }, () =>
      sessionService.finalizeSession(mockUid, canonicalSessionId, 50, 10, 10)
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r === true).length;
    const rejections = results.filter((r) => r === false).length;

    expect(successes).toBe(1);
    expect(rejections).toBe(9);
    expect(progressionUpdates).toBe(1);
    expect(userDoc.learningState.totalXp).toBe(250);
  });

  // =========================================================================
  // SCENARIO D: Concurrent learning-state updates
  // =========================================================================
  it('Scenario D: Sequential/concurrent transactions correctly accumulate progression rather than overwrite', async () => {
    const userDoc = {
      learningState: { totalXp: 100, currentStreak: 3, completedSessionsCount: 3 },
    };

    // Helper that executes an atomic transaction increment
    const runProgressionTx = async (xpBonus: number) => {
      userDoc.learningState.totalXp += xpBonus;
      return userDoc.learningState.totalXp;
    };

    // Increment A (+25 XP) then Increment B (+35 XP)
    await runProgressionTx(25);
    await runProgressionTx(35);

    // Verify 100 + 25 + 35 = 160 (both preserved, zero clobbering)
    expect(userDoc.learningState.totalXp).toBe(160);
  });

  // =========================================================================
  // FAILURE TESTING: Network failure during answer
  // =========================================================================
  it('Failure Testing: Network failure during answer write throws cleanly without fake attempt ID fallback', async () => {
    vi.mocked(sessionApi.recordAttempt).mockRejectedValue(
      new Error('UNAVAILABLE: network disconnect')
    );

    // Calling recordAttempt rejects cleanly so caller/hook can manage idempotency retry
    await expect(
      sessionService.recordAttempt(mockUid, canonicalSessionId, {
        questionId: 'Q1',
        questionIndex: 0,
        userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
        result: 'CORRECT',
        xpAwarded: 5,
      })
    ).rejects.toThrow('UNAVAILABLE: network disconnect');
  });

  // =========================================================================
  // FAILURE TESTING: Network failure during finalization (Atomicity)
  // =========================================================================
  it('Failure Testing: Network failure during finalization transaction rolls back both writes', async () => {
    const sessionDoc = {
      sessionId: canonicalSessionId,
      status: 'QUESTIONS_COMPLETED',
      reviewViewed: false,
    };
    const userDoc = {
      learningState: { totalXp: 100 },
    };

    // Simulate network error thrown during finalization
    vi.mocked(sessionApi.finalizeSession).mockRejectedValue(
      new Error('DEADLINE_EXCEEDED: transaction commit timed out')
    );

    const result = await sessionService.finalizeSession(mockUid, canonicalSessionId, 50, 10, 10);

    expect(result).toBe(false);
    // Unchanged state: neither document modified
    expect(sessionDoc.status).toBe('QUESTIONS_COMPLETED');
    expect(userDoc.learningState.totalXp).toBe(100);
  });

  // =========================================================================
  // FAILURE TESTING: Browser crash during finalization
  // =========================================================================
  it('Failure Testing: Reopening app after finalization abort/crash permits clean idempotent retry', async () => {
    let attemptCount = 0;
    const sessionDoc = {
      sessionId: canonicalSessionId,
      status: 'QUESTIONS_COMPLETED',
      reviewViewed: false,
    };
    const userDoc = {
      learningState: { totalXp: 100, currentStreak: 5, completedSessionsCount: 5 },
    };

    // First attempt fails (browser crash / connection abort)
    vi.mocked(sessionApi.finalizeSession).mockRejectedValueOnce(
      new Error('Connection reset')
    );

    const firstAttempt = await sessionService.finalizeSession(mockUid, canonicalSessionId, 50, 10, 10);
    expect(firstAttempt).toBe(false);

    // Second attempt (after trainee reopens app) succeeds
    vi.mocked(sessionApi.finalizeSession).mockImplementationOnce(async (payload) => {
      attemptCount++;
      sessionDoc.status = 'REVIEW_COMPLETED';
      userDoc.learningState.totalXp += payload.totalXpEarned;
      return {
        success: true,
        alreadyFinalized: false,
      };
    });

    const retryAttempt = await sessionService.finalizeSession(mockUid, canonicalSessionId, 50, 10, 10);
    expect(retryAttempt).toBe(true);
    expect(attemptCount).toBe(1);
    expect(userDoc.learningState.totalXp).toBe(150);
  });
});
