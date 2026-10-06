import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../src/services/SessionService';
import { StorageRepository } from '../src/repositories/StorageRepository';
import { StoredSessionRecord, UserStats } from '../src/models/session.types';
import { FirestoreSecurityRuleEvaluator } from './FirestoreSecurityRulesIntegration.test';

// Mock firebase/firestore for SessionService unit testing
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(),
    doc: vi.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
    arrayUnion: vi.fn((val) => [val]),
  };
});

// Import the mocked firestore functions
import * as firestoreModule from 'firebase/firestore';

describe('SessionService.finalizeSession() Idempotency & Security Verification', () => {
  let sessionService: SessionService;
  const mockUid = 'trainee_test_uid_01';
  const mockSessionId = 'daily_2026-10-06_trainee_';

  beforeEach(() => {
    vi.clearAllMocks();
    sessionService = new SessionService();
  });

  it('updates learningState ONCE during initial session finalization', async () => {
    // Session is IN_PROGRESS
    const mockSessionData = {
      sessionId: mockSessionId,
      userId: mockUid,
      status: 'IN_PROGRESS',
      reviewViewed: false,
    };

    const mockUserData = {
      learningState: {
        totalXp: 100,
        currentStreak: 5,
        completedSessionsCount: 5,
        completedQuestionsCount: 50,
        totalCorrectAnswersCount: 40,
        longestStreak: 5,
      },
    };

    vi.mocked(firestoreModule.getDoc).mockImplementation(async (ref: any) => {
      if (ref.path.includes('dailySessions')) {
        return {
          exists: () => true,
          data: () => mockSessionData,
        } as any;
      }
      if (ref.path.includes('users/')) {
        return {
          exists: () => true,
          data: () => mockUserData,
        } as any;
      }
      return { exists: () => false } as any;
    });

    vi.mocked(firestoreModule.updateDoc).mockResolvedValue(undefined as any);

    const result = await sessionService.finalizeSession(
      mockUid,
      mockSessionId,
      50, // totalXpEarned
      8,  // correctCount
      10  // totalQuestions
    );

    expect(result).toBe(true);

    // Verify session document transitioned to REVIEW_COMPLETED
    expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: `users/${mockUid}/dailySessions/${mockSessionId}` }),
      expect.objectContaining({
        status: 'REVIEW_COMPLETED',
        reviewViewed: true,
      })
    );

    // Verify learningState was updated
    expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: `users/${mockUid}` }),
      expect.objectContaining({
        'learningState.totalXp': 150,
        'learningState.currentStreak': 6,
        'learningState.completedSessionsCount': 6,
        'learningState.completedQuestionsCount': 60,
        'learningState.totalCorrectAnswersCount': 48,
      })
    );
  });

  it('strictly aborts and DOES NOT update learningState on duplicate finalizeSession call', async () => {
    // Session is ALREADY finalized (status: REVIEW_COMPLETED)
    const mockCompletedSessionData = {
      sessionId: mockSessionId,
      userId: mockUid,
      status: 'REVIEW_COMPLETED',
      reviewViewed: true,
      completedAt: 'MOCK_TIMESTAMP',
    };

    vi.mocked(firestoreModule.getDoc).mockImplementation(async (ref: any) => {
      if (ref.path.includes('dailySessions')) {
        return {
          exists: () => true,
          data: () => mockCompletedSessionData,
        } as any;
      }
      return { exists: () => true, data: () => ({}) } as any;
    });

    vi.mocked(firestoreModule.updateDoc).mockResolvedValue(undefined as any);

    // Trigger duplicate finalization call
    const result = await sessionService.finalizeSession(
      mockUid,
      mockSessionId,
      50,
      8,
      10
    );

    // Must return false indicating duplicate call was rejected
    expect(result).toBe(false);

    // MUST NOT update dailySession document
    expect(firestoreModule.updateDoc).not.toHaveBeenCalled();
  });

  it('strictly aborts learningState update if Firestore security rules reject updating an already-completed session', async () => {
    // Session appears IN_PROGRESS in local snap, but concurrent write caused rule rejection
    const mockSessionData = {
      sessionId: mockSessionId,
      userId: mockUid,
      status: 'IN_PROGRESS',
      reviewViewed: false,
    };

    vi.mocked(firestoreModule.getDoc).mockImplementation(async (ref: any) => {
      if (ref.path.includes('dailySessions')) {
        return {
          exists: () => true,
          data: () => mockSessionData,
        } as any;
      }
      return { exists: () => true, data: () => ({}) } as any;
    });

    // Simulate Firestore Security Rules PERMISSION_DENIED on updateDoc
    vi.mocked(firestoreModule.updateDoc).mockRejectedValue(
      new Error('PERMISSION_DENIED: Missing or insufficient permissions.')
    );

    const result = await sessionService.finalizeSession(
      mockUid,
      mockSessionId,
      50,
      8,
      10
    );

    expect(result).toBe(false);

    // Must NOT have called updateDoc on user profile
    const calls = vi.mocked(firestoreModule.updateDoc).mock.calls;
    const userProfileUpdates = calls.filter((c) =>
      (c[0] as any).path === `users/${mockUid}`
    );
    expect(userProfileUpdates.length).toBe(0);
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
    expect(statsAfterFirst.totalXp).toBe(150);
    expect(statsAfterFirst.completedSessionsCount).toBe(6);
    expect(statsAfterFirst.completedQuestionsCount).toBe(60);
    expect(statsAfterFirst.totalCorrectAnswersCount).toBe(48);

    // Duplicate save with identical sessionId: MUST NOT re-increment stats
    await storage.saveSession(sessionRecord);

    const statsAfterSecond = await storage.getUserStats();
    expect(statsAfterSecond.totalXp).toBe(150); // Unchanged!
    expect(statsAfterSecond.completedSessionsCount).toBe(6); // Unchanged!
    expect(statsAfterSecond.completedQuestionsCount).toBe(60); // Unchanged!
    expect(statsAfterSecond.totalCorrectAnswersCount).toBe(48); // Unchanged!
  });
});
