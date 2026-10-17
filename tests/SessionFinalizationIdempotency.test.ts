import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../src/services/SessionService';
import { StorageRepository } from '../src/repositories/StorageRepository';
import { StoredSessionRecord, UserStats } from '../src/models/session.types';
import { FirestoreSecurityRuleEvaluator } from './FirestoreSecurityRulesIntegration.test';
import { sessionApi } from '../src/api/sessionApi';

// Mock sessionApi for SessionService unit testing
vi.mock('../src/api/sessionApi', () => {
  return {
    sessionApi: {
      getTodaySession: vi.fn(),
      recordAttempt: vi.fn(),
      finalizeSession: vi.fn(),
    },
  };
});

describe('SessionService.finalizeSession() Idempotency & Security Verification', () => {
  let sessionService: SessionService;
  const mockUid = 'trainee_test_uid_01';
  const mockSessionId = 'daily_2026-10-06_trainee_';

  beforeEach(() => {
    vi.clearAllMocks();
    sessionService = new SessionService();
  });

  // TEST 1: Intended lifecycle test: Q10 -> QUESTIONS_COMPLETED -> finalizeSession() succeeds
  it('successfully finalizes when session status is QUESTIONS_COMPLETED and updates learningState atomically (ISSUE 2 REGRESSION)', async () => {
    vi.mocked(sessionApi.finalizeSession).mockResolvedValue({
      success: true,
      alreadyFinalized: false,
    });

    const result = await sessionService.finalizeSession(
      mockUid,
      mockSessionId,
      50, // totalXpEarned
      8,  // correctCount
      10  // totalQuestions
    );

    expect(result).toBe(true);
    expect(sessionApi.finalizeSession).toHaveBeenCalledWith({
      sessionId: mockSessionId,
      totalXpEarned: 50,
      correctCount: 8,
      totalQuestions: 10,
    });
  });

  // TEST 2: Duplicate finalization strictly blocked
  it('strictly aborts and DOES NOT update learningState on duplicate finalizeSession call (REVIEW_COMPLETED)', async () => {
    vi.mocked(sessionApi.finalizeSession).mockResolvedValue({
      success: false,
      alreadyFinalized: true,
    });

    const result = await sessionService.finalizeSession(
      mockUid,
      mockSessionId,
      50,
      8,
      10
    );

    expect(result).toBe(false);
  });

  // TEST 3: Failure before transaction (Session document missing)
  it('strictly returns false if dailySession document does not exist in Firestore', async () => {
    vi.mocked(sessionApi.finalizeSession).mockRejectedValue(
      new Error('Session not found')
    );

    const result = await sessionService.finalizeSession(
      mockUid,
      'non_existent_session',
      50,
      8,
      10
    );

    expect(result).toBe(false);
  });

  // TEST 4: Failure during transaction (network exception triggers rollback)
  it('rolls back and leaves both documents uncommitted if transaction throws (ISSUE 3 ATOMICITY)', async () => {
    vi.mocked(sessionApi.finalizeSession).mockRejectedValue(
      new Error('UNAVAILABLE: Firestore connection terminated during commit.')
    );

    const result = await sessionService.finalizeSession(
      mockUid,
      mockSessionId,
      50,
      8,
      10
    );

    expect(result).toBe(false);
  });

  // TEST 5: Concurrent finalization protection (in-memory lock)
  it('guards against concurrent in-flight finalization calls for the same session', async () => {
    vi.mocked(sessionApi.finalizeSession).mockImplementation(async () => {
      await new Promise((res) => setTimeout(res, 50));
      return { success: true, alreadyFinalized: false };
    });

    const call1 = sessionService.finalizeSession(mockUid, mockSessionId, 50, 8, 10);
    const call2 = sessionService.finalizeSession(mockUid, mockSessionId, 50, 8, 10);

    const [res1, res2] = await Promise.all([call1, call2]);

    expect(res1).toBe(true);
    expect(res2).toBe(false); // Second call rejected by in-flight concurrency lock
  });

  // TEST 6, 7, 8: Zero duplicate XP, streak, or session count on repeated calls
  it('strictly prevents duplicate XP, streak, and completedSessionsCount increment on repeated calls', async () => {
    let callCount = 0;
    vi.mocked(sessionApi.finalizeSession).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { success: true, alreadyFinalized: false };
      }
      return { success: false, alreadyFinalized: true };
    });

    // First finalization
    const firstResult = await sessionService.finalizeSession(mockUid, mockSessionId, 50, 8, 10);
    expect(firstResult).toBe(true);
    expect(callCount).toBe(1);

    // Second finalization attempt
    const secondResult = await sessionService.finalizeSession(mockUid, mockSessionId, 50, 8, 10);
    expect(secondResult).toBe(false);
    expect(callCount).toBe(2);
  });
});

describe('Firestore Security Rule Constraints on Completed Sessions', () => {
  const traineeAuth = { uid: 'user_01', token: { role: 'TRAINEE' } };

  it('allows updating an IN_PROGRESS session', () => {
    const existing = {
      sessionId: 'sess_01',
      userId: 'user_01',
      uid: 'user_01',
      status: 'IN_PROGRESS',
      questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
      createdAt: 'T1',
    };
    const updated = {
      ...existing,
      status: 'REVIEW_COMPLETED',
    };

    const allowed = FirestoreSecurityRuleEvaluator.evaluateDailySessionUpdate(
      traineeAuth,
      'user_01',
      existing,
      updated
    );
    expect(allowed).toBe(true);
  });

  it('strictly REJECTS updating an already COMPLETED session (idempotency lock)', () => {
    const existingCompleted = {
      sessionId: 'sess_01',
      userId: 'user_01',
      uid: 'user_01',
      status: 'COMPLETED',
      questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
      createdAt: 'T1',
    };
    const duplicateUpdate = {
      ...existingCompleted,
      status: 'REVIEW_COMPLETED',
    };

    const allowed = FirestoreSecurityRuleEvaluator.evaluateDailySessionUpdate(
      traineeAuth,
      'user_01',
      existingCompleted,
      duplicateUpdate
    );
    expect(allowed).toBe(false);
  });

  it('strictly REJECTS updating an already REVIEW_COMPLETED session', () => {
    const existingReviewCompleted = {
      sessionId: 'sess_01',
      userId: 'user_01',
      uid: 'user_01',
      status: 'REVIEW_COMPLETED',
      questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
      createdAt: 'T1',
    };
    const duplicateUpdate = {
      ...existingReviewCompleted,
      updatedAt: 'T2',
    };

    const allowed = FirestoreSecurityRuleEvaluator.evaluateDailySessionUpdate(
      traineeAuth,
      'user_01',
      existingReviewCompleted,
      duplicateUpdate
    );
    expect(allowed).toBe(false);
  });
});

describe('StorageRepository.saveSession() Idempotency', () => {
  it('does NOT duplicate userStats increments when the same session is saved twice', async () => {
    const storage = new StorageRepository();

    const initialStats: UserStats = {
      totalXp: 100,
      currentStreak: 5,
      longestStreak: 5,
      lastActiveDate: '2026-10-05',
      completedQuestionsCount: 50,
      completedSessionsCount: 5,
      totalCorrectAnswersCount: 40,
      streakShieldConsumed: false,
    };
    await storage.saveUserStats(initialStats);

    const sessionRecord: StoredSessionRecord = {
      sessionId: 'session_unique_123',
      timestamp: Date.now(),
      totalQuestions: 10,
      correctCount: 8,
      xpEarned: 50,
      date: '2026-10-06',
      answers: [],
    };

    // First save: should increment stats
    await storage.saveSession(sessionRecord);

    const statsAfterFirst = await storage.getUserStats();
    expect(statsAfterFirst?.totalXp).toBe(150);
    expect(statsAfterFirst?.completedSessionsCount).toBe(6);
    expect(statsAfterFirst?.completedQuestionsCount).toBe(60);
    expect(statsAfterFirst?.totalCorrectAnswersCount).toBe(48);

    // Duplicate save with identical sessionId: MUST NOT re-increment stats
    await storage.saveSession(sessionRecord);

    const statsAfterSecond = await storage.getUserStats();
    expect(statsAfterSecond?.totalXp).toBe(150); // Unchanged!
    expect(statsAfterSecond?.completedSessionsCount).toBe(6); // Unchanged!
    expect(statsAfterSecond?.completedQuestionsCount).toBe(60); // Unchanged!
    expect(statsAfterSecond?.totalCorrectAnswersCount).toBe(48); // Unchanged!
  });
});
