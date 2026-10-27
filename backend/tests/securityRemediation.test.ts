import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthUseCase } from '../src/application/usecases/AuthUseCase.js';
import { SessionUseCase } from '../src/application/usecases/SessionUseCase.js';
import { IUserRepository } from '../src/domain/interfaces/IUserRepository.js';
import { ISessionRepository } from '../src/domain/interfaces/ISessionRepository.js';
import { IAuthProvider } from '../src/domain/interfaces/IAuthProvider.js';
import { FirestoreUserRepository } from '../src/infrastructure/firestore/FirestoreUserRepository.js';
import { FirestoreSessionRepository } from '../src/infrastructure/firestore/FirestoreSessionRepository.js';
import { adminDb } from '../src/infrastructure/config/firebaseAdmin.js';
import { UserProfileDoc } from '../src/domain/models/user.model.js';
import { SessionController, sessionUseCase as defaultSessionUseCase } from '../src/api/controllers/SessionController.js';
import { errorHandler } from '../src/api/middlewares/error.middleware.js';

describe('Security & Data-Integrity Remediation Suite (F-01, F-02, F-03)', () => {
  // =========================================================================
  // F-02: PROFILE UPDATE PROTECTION & ALLOW-LISTING
  // =========================================================================
  describe('F-02: Profile Update Protection', () => {
    let mockUserRepo: IUserRepository;
    let mockAuthProvider: IAuthProvider;
    let authUseCase: AuthUseCase;

    const baseProfileDoc: UserProfileDoc = {
      uid: 'trainee_target_456',
      username: 'anita.deshmukh',
      syntheticEmail: 'anita.deshmukh@trainee.aisteth.app',
      displayName: 'Anita Deshmukh',
      designation: 'Staff Nurse',
      healthSubCentre: 'Subcentre A',
      district: 'Amravati',
      state: 'Maharashtra',
      optionalEmail: 'anita@example.com',
      role: 'TRAINEE',
      organizationId: 'org_rbsk',
      createdAt: '2026-01-01T00:00:00.000Z',
      learningState: {
        totalXp: 350,
        currentStreak: 12,
        longestStreak: 15,
        completedSessionsCount: 10,
        completedQuestionsCount: 100,
        totalCorrectAnswersCount: 88,
        currentLevel: 3,
        streakShieldActive: false,
        streakShieldConsumed: false,
      },
    };

    beforeEach(() => {
      mockUserRepo = {
        findByUid: vi.fn().mockResolvedValue(baseProfileDoc),
        findByUsername: vi.fn(),
        reserveUsername: vi.fn(),
        releaseUsername: vi.fn(),
        activateUsername: vi.fn(),
        createUserProfile: vi.fn(),
        updateUserProfile: vi.fn().mockResolvedValue(undefined),
        updateLearningState: vi.fn(),
      };

      mockAuthProvider = {
        createUser: vi.fn(),
        authenticateWithPassword: vi.fn(),
        verifyIdToken: vi.fn(),
        refreshToken: vi.fn(),
        revokeUserSessions: vi.fn(),
        deleteUser: vi.fn(),
        generatePasswordResetLink: vi.fn(),
      };

      authUseCase = new AuthUseCase(mockUserRepo, mockAuthProvider);
    });

    it('allows updating legitimate, allow-listed profile fields with string sanitization', async () => {
      await authUseCase.updateProfile('trainee_target_456', {
        displayName: '  Sister Anita Deshmukh  ',
        designation: '  Senior Staff Nurse  ',
        healthSubCentre: '  Subcentre North  ',
        optionalEmail: '  anita.work@hospital.org  ',
      });

      expect(mockUserRepo.updateUserProfile).toHaveBeenCalledWith('trainee_target_456', {
        displayName: 'Sister Anita Deshmukh',
        designation: 'Senior Staff Nurse',
        healthSubCentre: 'Subcentre North',
        optionalEmail: 'anita.work@hospital.org',
      });
    });

    it('safely discards protected fields (learningState, XP, streak, role, org, uid, username)', async () => {
      const maliciousPayload: any = {
        displayName: 'Anita D.',
        // Protected fields that MUST be stripped:
        learningState: {
          totalXp: 999999,
          currentStreak: 999,
          currentLevel: 31,
        },
        role: 'SUPER_ADMIN',
        organizationId: 'malicious_org',
        uid: 'attacker_uid_999',
        username: 'forged.username',
        syntheticEmail: 'hacked@aisteth.app',
        trainingTimeZone: 'America/New_York',
        createdAt: '2000-01-01T00:00:00.000Z',
        lastActiveAt: '2000-01-01T00:00:00.000Z',
        isAdmin: true,
        extraInjectedField: 'hack_attempt',
      };

      await authUseCase.updateProfile('trainee_target_456', maliciousPayload);

      // Verify ONLY the allow-listed displayName is passed to the persistence layer
      expect(mockUserRepo.updateUserProfile).toHaveBeenCalledTimes(1);
      expect(mockUserRepo.updateUserProfile).toHaveBeenCalledWith('trainee_target_456', {
        displayName: 'Anita D.',
      });
    });

    it('does not invoke persistence update if payload contains only unapproved/protected fields', async () => {
      const onlyProtectedPayload: any = {
        learningState: { totalXp: 999999 },
        role: 'ADMIN',
        uid: 'forged_uid',
      };

      await authUseCase.updateProfile('trainee_target_456', onlyProtectedPayload);

      // updateUserProfile should not be called because no valid editable fields were provided
      expect(mockUserRepo.updateUserProfile).not.toHaveBeenCalled();
    });

    it('rejects invalid displayName with validation error', async () => {
      await expect(
        authUseCase.updateProfile('trainee_target_456', { displayName: '   ' })
      ).rejects.toThrow('Display name must be a non-empty string.');

      await expect(
        authUseCase.updateProfile('trainee_target_456', { displayName: 12345 as any })
      ).rejects.toThrow('Display name must be a non-empty string.');
    });

    it('rejects invalid designation with validation error', async () => {
      await expect(
        authUseCase.updateProfile('trainee_target_456', { designation: '   ' })
      ).rejects.toThrow('Designation must be a non-empty string.');
    });

    it('rejects malformed optionalEmail with validation error', async () => {
      await expect(
        authUseCase.updateProfile('trainee_target_456', { optionalEmail: 'invalid-email-address' })
      ).rejects.toThrow('Optional email format is invalid.');
    });

    it('rejects invalid payload types (null, non-object)', async () => {
      await expect(
        authUseCase.updateProfile('trainee_target_456', null as any)
      ).rejects.toThrow('Invalid update payload.');

      await expect(
        authUseCase.updateProfile('trainee_target_456', [] as any)
      ).rejects.toThrow('Invalid update payload.');
    });

    it('defensively strips protected fields in FirestoreUserRepository persistence layer', async () => {
      const repo = new FirestoreUserRepository();
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDoc = vi.spyOn(adminDb, 'doc').mockReturnValue({
        update: mockUpdate,
      } as any);

      const payloadWithProtected: any = {
        displayName: 'Dr. Persisted Name',
        learningState: { totalXp: 50000 },
        role: 'ADMIN',
        roles: ['ADMIN', 'SUPERVISOR'],
        organizationId: 'injected_org',
        uid: 'victim_uid',
        username: 'stolen_handle',
        syntheticEmail: 'stolen@app.com',
        trainingTimeZone: 'UTC',
        createdAt: '1970-01-01',
        lastActiveAt: '1970-01-01',
        totalXp: 50000,
        xp: 50000,
        level: 30,
        currentLevel: 30,
        streak: 99,
        currentStreak: 99,
      };

      await repo.updateUserProfile('user_123', payloadWithProtected);

      expect(mockDoc).toHaveBeenCalledWith('users/user_123');
      expect(mockUpdate).toHaveBeenCalledTimes(1);

      const passedData = mockUpdate.mock.calls[0][0];
      expect(passedData.displayName).toBe('Dr. Persisted Name');
      expect(passedData.learningState).toBeUndefined();
      expect(passedData.role).toBeUndefined();
      expect(passedData.roles).toBeUndefined();
      expect(passedData.organizationId).toBeUndefined();
      expect(passedData.uid).toBeUndefined();
      expect(passedData.username).toBeUndefined();
      expect(passedData.syntheticEmail).toBeUndefined();
      expect(passedData.trainingTimeZone).toBeUndefined();
      expect(passedData.createdAt).toBeUndefined();
      expect(passedData.lastActiveAt).toBeUndefined();
      expect(passedData.totalXp).toBeUndefined();
      expect(passedData.xp).toBeUndefined();
      expect(passedData.level).toBeUndefined();
      expect(passedData.currentLevel).toBeUndefined();
      expect(passedData.streak).toBeUndefined();
      expect(passedData.currentStreak).toBeUndefined();

      mockDoc.mockRestore();
    });
  });

  // =========================================================================
  // F-01: SERVER-AUTHORITATIVE XP & SESSION FINALIZATION
  // =========================================================================
  describe('F-01: Server-Authoritative XP & Session Finalization', () => {
    let mockSessionRepo: ISessionRepository;
    let mockQuestionRepo: any;
    let sessionUseCase: SessionUseCase;

    beforeEach(() => {
      mockSessionRepo = {
        getDailySession: vi.fn(),
        createDailySession: vi.fn(),
        appendAttempt: vi.fn(),
        updateSessionProgress: vi.fn(),
        recordAttemptAtomic: vi.fn(),
        finalizeSessionAtomic: vi.fn(),
      };

      mockQuestionRepo = {
        getAllQuestions: vi.fn(),
        getQuestionById: vi.fn(),
        getSessionQuestions: vi.fn(),
        getFollowUpQuestion: vi.fn(),
      };

      sessionUseCase = new SessionUseCase(mockSessionRepo, mockQuestionRepo);
    });

    const createMockQuestion = (id: string, correctOption = 'option_a') => ({
      question_id: id,
      type: 'MCQ' as const,
      category: 'HEART_RECORDING' as const,
      difficulty: 'BEGINNER' as const,
      question: 'Sample Question',
      correct_answer: correctOption,
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      explanation: 'Explanation',
      learning_objective: 'Objective',
      tags: [],
      clinician_validated: true,
      source: 'CLINICAL' as const,
      version: '1.0.0',
    });

    it('delegates attempt evaluation to AnswerEvaluator and calls recordAttemptAtomic', async () => {
      mockQuestionRepo.getQuestionById.mockResolvedValue(createMockQuestion('q0'));
      vi.mocked(mockSessionRepo.recordAttemptAtomic).mockResolvedValue({
        attemptId: 'att_atomic_1',
        currentQuestionIndex: 1,
        isSessionComplete: false,
        totalXpEarned: 5,
        correctCount: 1,
      });

      const res = await sessionUseCase.recordAttempt('user_123', {
        sessionId: 'session_abc',
        questionId: 'q0',
        questionIndex: 0,
        userAnswerPayload: { question_id: 'q0', type: 'MCQ', selected_option: 'option_a' },
      });

      expect(res.success).toBe(true);
      expect(res.attemptId).toBe('att_atomic_1');
      expect(res.evaluation.is_correct).toBe(true);
      expect(res.evaluation.awarded_xp).toBe(5);

      expect(mockSessionRepo.recordAttemptAtomic).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user_123',
          sessionId: 'session_abc',
          questionId: 'q0',
          questionIndex: 0,
          evaluation: expect.objectContaining({ is_correct: true, awarded_xp: 5 }),
        })
      );
    });

    it('ignores client-supplied forged totalXpEarned and correctCount in SessionUseCase', async () => {
      vi.mocked(mockSessionRepo.finalizeSessionAtomic).mockResolvedValue({
        success: true,
        alreadyFinalized: false,
        updatedLearningState: {
          totalXp: 145,
          currentStreak: 6,
          longestStreak: 6,
          lastActiveDate: '2026-10-09',
          completedSessionsCount: 6,
          completedQuestionsCount: 60,
          totalCorrectAnswersCount: 42,
          currentLevel: 2,
        },
      });

      // Client attempts to claim 99,999 XP and 100 correct answers
      const res = await sessionUseCase.finalizeSession('trainee_test_123', {
        sessionId: 'daily_2026-10-09_trainee_',
        totalXpEarned: 99999,
        correctCount: 100,
        totalQuestions: 10,
      });

      // finalizeSessionAtomic must be called with session identification only, without client-dictated XP or metrics
      expect(mockSessionRepo.finalizeSessionAtomic).toHaveBeenCalledWith({
        uid: 'trainee_test_123',
        sessionId: 'daily_2026-10-09_trainee_',
        todayDateStr: expect.any(String),
      });
      expect(res.success).toBe(true);
      expect(res.updatedStats?.totalXp).toBe(145);
    });

    it('derives XP authoritatively from server session records in FirestoreSessionRepository', async () => {
      const repo = new FirestoreSessionRepository();

      const mockSessionData = {
        sessionId: 'daily_2026-10-09_trainee',
        uid: 'user_xyz',
        date: '2026-10-09',
        status: 'QUESTIONS_COMPLETED',
        questionsCompleted: true,
        totalXpEarned: 35, // Server-verified XP accumulated during attempts
        correctCount: 7,   // Server-verified correct answers
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        currentQuestionIndex: 10,
        reviewViewed: false,
      };

      const mockUserData = {
        lastActiveDate: '2026-10-08',
        learningState: {
          lastActiveDate: '2026-10-08',
          totalXp: 100,
          currentStreak: 5,
          longestStreak: 10,
          completedSessionsCount: 5,
          completedQuestionsCount: 50,
          totalCorrectAnswersCount: 35,
          currentLevel: 2,
        },
      };

      const transactionUpdateMock = vi.fn();
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.path.includes('dailySessions')) {
            return Promise.resolve({ exists: true, data: () => mockSessionData });
          }
          return Promise.resolve({ exists: true, data: () => mockUserData });
        }),
        update: transactionUpdateMock,
      };

      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        async (cb: any) => cb(mockTransaction)
      );

      const result = await repo.finalizeSessionAtomic({
        uid: 'user_xyz',
        sessionId: 'daily_2026-10-09_trainee',
        todayDateStr: '2026-10-09',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyFinalized).toBe(false);

      // Under Stage 3 rules, finalization awards 0 XP and does not re-award attempt XP or re-increment question counts
      // Authoritative totalXp remains 100, completedQuestionsCount remains 50
      expect(result.updatedLearningState?.totalXp).toBe(100);
      expect(result.updatedLearningState?.currentStreak).toBe(6);
      expect(result.updatedLearningState?.completedSessionsCount).toBe(6);
      expect(result.updatedLearningState?.completedQuestionsCount).toBe(50);
      expect(result.updatedLearningState?.totalCorrectAnswersCount).toBe(42);

      // Verify transaction updates
      expect(transactionUpdateMock).toHaveBeenCalledTimes(2);

      // Session document update verification
      const sessionUpdateArgs = transactionUpdateMock.mock.calls[0][1];
      expect(sessionUpdateArgs.status).toBe('REVIEW_COMPLETED');
      expect(sessionUpdateArgs.reviewViewed).toBe(true);
      expect(sessionUpdateArgs.totalXpEarned).toBe(35);
      expect(sessionUpdateArgs.correctCount).toBe(7);

      // User profile update verification
      const userUpdateArgs = transactionUpdateMock.mock.calls[1][1];
      expect(userUpdateArgs.totalXp).toBe(100);
      expect(userUpdateArgs.completedQuestionsCount).toBe(50);
      expect(userUpdateArgs.learningState.totalXp).toBe(100);
      expect(userUpdateArgs.learningState.totalCorrectAnswersCount).toBe(42);

      runTransactionSpy.mockRestore();
    });

    it('does not award completion bonus or increment completedSessionsCount for incomplete sessions', async () => {
      const repo = new FirestoreSessionRepository();

      const mockIncompleteSessionData = {
        sessionId: 'daily_2026-10-09_trainee',
        uid: 'user_xyz',
        date: '2026-10-09',
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        totalXpEarned: 20, // 4 questions correct out of 5 attempted
        correctCount: 4,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        currentQuestionIndex: 5,
        reviewViewed: false,
      };

      const mockUserData = {
        learningState: {
          totalXp: 100,
          currentStreak: 5,
          longestStreak: 10,
          completedSessionsCount: 5,
          completedQuestionsCount: 50,
          totalCorrectAnswersCount: 35,
          currentLevel: 2,
        },
      };

      const transactionUpdateMock = vi.fn();
      const mockTransaction = {
        get: vi.fn().mockImplementation((ref: any) => {
          if (ref.path.includes('dailySessions')) {
            return Promise.resolve({ exists: true, data: () => mockIncompleteSessionData });
          }
          return Promise.resolve({ exists: true, data: () => mockUserData });
        }),
        update: transactionUpdateMock,
      };

      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        async (cb: any) => cb(mockTransaction)
      );

      const result = await repo.finalizeSessionAtomic({
        uid: 'user_xyz',
        sessionId: 'daily_2026-10-09_trainee',
        todayDateStr: '2026-10-09',
      });

      expect(result.success).toBe(true);
      // Under Stage 3 rules: finalization awards 0 XP, completedSessionsCount remains 5, completedQuestionsCount remains 50
      expect(result.updatedLearningState?.totalXp).toBe(100);
      // completedSessionsCount is NOT incremented (remains 5)
      expect(result.updatedLearningState?.completedSessionsCount).toBe(5);
      // completedQuestionsCount remains unchanged (50)
      expect(result.updatedLearningState?.completedQuestionsCount).toBe(50);

      runTransactionSpy.mockRestore();
    });

    it('enforces idempotency on duplicate finalization requests without double-awarding XP', async () => {
      const repo = new FirestoreSessionRepository();

      const mockAlreadyFinalizedSession = {
        sessionId: 'daily_2026-10-09_trainee',
        uid: 'user_xyz',
        date: '2026-10-09',
        status: 'REVIEW_COMPLETED',
        reviewViewed: true,
        totalXpEarned: 45,
        correctCount: 7,
      };

      const transactionUpdateMock = vi.fn();
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockAlreadyFinalizedSession,
        }),
        update: transactionUpdateMock,
      };

      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        async (cb: any) => cb(mockTransaction)
      );

      const result = await repo.finalizeSessionAtomic({
        uid: 'user_xyz',
        sessionId: 'daily_2026-10-09_trainee',
        todayDateStr: '2026-10-09',
      });

      expect(result.success).toBe(false);
      expect(result.alreadyFinalized).toBe(true);
      // Ensure no database writes occurred on duplicate finalization
      expect(transactionUpdateMock).not.toHaveBeenCalled();

      runTransactionSpy.mockRestore();
    });

    it('handles concurrent finalizations safely via transactional terminal status check', async () => {
      const repo = new FirestoreSessionRepository();

      let executionCount = 0;
      const transactionUpdateMock = vi.fn();

      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        async (cb: any) => {
          executionCount++;
          // First invocation sees active session; second invocation sees REVIEW_COMPLETED terminal status
          const isFirst = executionCount === 1;
          const sessionData = {
            sessionId: 'daily_2026-10-09_trainee',
            status: isFirst ? 'QUESTIONS_COMPLETED' : 'REVIEW_COMPLETED',
            questionsCompleted: true,
            totalXpEarned: 40,
            correctCount: 8,
            reviewViewed: !isFirst,
          };
          const userData = { learningState: { totalXp: 100, completedSessionsCount: 1 } };

          const mockTx = {
            get: vi.fn().mockImplementation((ref: any) => {
              if (ref.path.includes('dailySessions')) {
                return Promise.resolve({ exists: true, data: () => sessionData });
              }
              return Promise.resolve({ exists: true, data: () => userData });
            }),
            update: transactionUpdateMock,
          };
          return cb(mockTx);
        }
      );

      // Run two simulated concurrent finalizations
      const [res1, res2] = await Promise.all([
        repo.finalizeSessionAtomic({
          uid: 'user_xyz',
          sessionId: 'daily_2026-10-09_trainee',
          todayDateStr: '2026-10-09',
        }),
        repo.finalizeSessionAtomic({
          uid: 'user_xyz',
          sessionId: 'daily_2026-10-09_trainee',
          todayDateStr: '2026-10-09',
        }),
      ]);

      expect(res1.alreadyFinalized).toBe(false);
      expect(res1.success).toBe(true);

      expect(res2.alreadyFinalized).toBe(true);
      expect(res2.success).toBe(false);

      // Writes only executed for the first request
      expect(transactionUpdateMock).toHaveBeenCalledTimes(2); // 1 session update + 1 user update

      runTransactionSpy.mockRestore();
    });
  });

  // =========================================================================
  // F-01: ANSWER SUBMISSION CONCURRENCY & IDEMPOTENCY (recordAttemptAtomic)
  // =========================================================================
  describe('F-01: Answer Submission Concurrency & Idempotency (recordAttemptAtomic)', () => {
    class MockFirestoreTransactionalStore {
      sessionData: Record<string, any>;
      attempts: Map<string, any> = new Map();
      version: number = 0;

      constructor(initialSession: Record<string, any>) {
        this.sessionData = JSON.parse(JSON.stringify(initialSession));
      }

      getSession(): Record<string, any> {
        return JSON.parse(JSON.stringify(this.sessionData));
      }

      getAttempts(): Map<string, any> {
        return new Map(this.attempts);
      }

      createMockRunTransaction() {
        return async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
          let attemptsCount = 0;
          const maxRetries = 5;

          while (attemptsCount < maxRetries) {
            attemptsCount++;
            const readVersion = this.version;
            const stagedSets = new Map<string, any>();
            const stagedUpdates = new Map<string, any>();

            const tx = {
              get: vi.fn().mockImplementation(async (ref: any) => {
                if (ref.path.includes('dailySessions')) {
                  return {
                    exists: true,
                    data: () => JSON.parse(JSON.stringify(this.sessionData)),
                  };
                }
                return { exists: false, data: () => undefined };
              }),
              set: vi.fn().mockImplementation((ref: any, data: any) => {
                stagedSets.set(ref.path, JSON.parse(JSON.stringify(data)));
              }),
              update: vi.fn().mockImplementation((ref: any, data: any) => {
                stagedUpdates.set(ref.path, JSON.parse(JSON.stringify(data)));
              }),
            };

            // Small delay to simulate async network flight and enable concurrent race conditions
            await new Promise((r) => setTimeout(r, 2));

            const result = await updateFunction(tx);

            // Optimistic Concurrency Control (OCC) check:
            // If another transaction committed while this transaction was running,
            // Firestore triggers a retry with fresh document state.
            if (this.version !== readVersion) {
              continue;
            }

            // Commit atomic writes
            for (const [path, data] of stagedSets.entries()) {
              if (path.includes('attempts')) {
                this.attempts.set(path, data);
              }
            }
            for (const [path, data] of stagedUpdates.entries()) {
              if (path.includes('dailySessions')) {
                Object.assign(this.sessionData, data);
              }
            }
            this.version++;
            return result;
          }

          throw new Error('Transaction contention limit reached.');
        };
      }
    }

    it('1. rejects sequential duplicate submission after first attempt is committed and preserves state', async () => {
      const initialSession = {
        sessionId: 'daily_2026-10-09_test',
        uid: 'user_race_1',
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        contentReleaseId: 'rel_v1_0_0',
      };

      const store = new MockFirestoreTransactionalStore(initialSession);
      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        store.createMockRunTransaction() as any
      );
      const repo = new FirestoreSessionRepository();

      // Legitimate first attempt for question 0
      const firstResult = await repo.recordAttemptAtomic({
        uid: 'user_race_1',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q1',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
      });

      expect(firstResult.currentQuestionIndex).toBe(1);
      expect(firstResult.totalXpEarned).toBe(5);
      expect(firstResult.correctCount).toBe(1);

      // Verify persisted state after first commit
      let persisted = store.getSession();
      expect(persisted.currentQuestionIndex).toBe(1);
      expect(persisted.totalXpEarned).toBe(5);
      expect(persisted.correctCount).toBe(1);
      expect(store.getAttempts().size).toBe(1);

      // Sequential duplicate submission for the same question index 0
      await expect(
        repo.recordAttemptAtomic({
          uid: 'user_race_1',
          sessionId: 'daily_2026-10-09_test',
          questionId: 'q1',
          questionIndex: 0,
          userAnswerPayload: { selected_option: 'option_a' },
          evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
        })
      ).rejects.toThrow('Question index mismatch: expected question index 1, but received 0.');

      // Verify persisted state is unchanged: XP, correct count, index, and attempt records MUST NOT duplicate
      persisted = store.getSession();
      expect(persisted.currentQuestionIndex).toBe(1);
      expect(persisted.totalXpEarned).toBe(5);
      expect(persisted.correctCount).toBe(1);
      expect(store.getAttempts().size).toBe(1);

      runTransactionSpy.mockRestore();
    });

    it('2. handles two concurrent submissions for the same question without double XP or duplicate attempts', async () => {
      const initialSession = {
        sessionId: 'daily_2026-10-09_test',
        uid: 'user_race_2',
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        contentReleaseId: 'rel_v1_0_0',
      };

      const store = new MockFirestoreTransactionalStore(initialSession);
      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        store.createMockRunTransaction() as any
      );
      const repo = new FirestoreSessionRepository();

      // Launch two concurrent requests with identical questionIndex 0
      const req1 = repo.recordAttemptAtomic({
        uid: 'user_race_2',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q1',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
      });

      const req2 = repo.recordAttemptAtomic({
        uid: 'user_race_2',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q1',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
      });

      const settled = await Promise.allSettled([req1, req2]);
      const fulfilled = settled.filter((s) => s.status === 'fulfilled');
      const rejected = settled.filter((s) => s.status === 'rejected');

      // Exactly one request must succeed, and one must be rejected due to OCC index mismatch
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('Question index mismatch');

      // Crucial: verify persisted Firestore state
      const persisted = store.getSession();
      expect(persisted.currentQuestionIndex).toBe(1);
      expect(persisted.totalXpEarned).toBe(5); // MUST be 5, NOT 10
      expect(persisted.correctCount).toBe(1);   // MUST be 1, NOT 2
      expect(store.getAttempts().size).toBe(1); // MUST have exactly 1 attempt document

      runTransactionSpy.mockRestore();
    });

    it('3. handles two concurrent submissions with different answers for the same expected question index', async () => {
      const initialSession = {
        sessionId: 'daily_2026-10-09_test',
        uid: 'user_race_3',
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        contentReleaseId: 'rel_v1_0_0',
      };

      const store = new MockFirestoreTransactionalStore(initialSession);
      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        store.createMockRunTransaction() as any
      );
      const repo = new FirestoreSessionRepository();

      // Req A: answer_a (correct, 5 XP)
      const reqA = repo.recordAttemptAtomic({
        uid: 'user_race_3',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q1',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
      });

      // Req B: answer_b (incorrect, 0 XP)
      const reqB = repo.recordAttemptAtomic({
        uid: 'user_race_3',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q1',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_b' },
        evaluation: { is_correct: false, awarded_xp: 0, question_id: 'q1', feedback_html: '' },
      });

      const settled = await Promise.allSettled([reqA, reqB]);
      const fulfilled = settled.filter((s) => s.status === 'fulfilled');
      const rejected = settled.filter((s) => s.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('Question index mismatch');

      // Verify persisted state: only the winning transaction was persisted
      const persisted = store.getSession();
      expect(persisted.currentQuestionIndex).toBe(1);
      expect(store.getAttempts().size).toBe(1);
      // Total XP must reflect only the single winning attempt (0 or 5, never both)
      expect([0, 5]).toContain(persisted.totalXpEarned);

      runTransactionSpy.mockRestore();
    });

    it('4. permits legitimate sequential submission of the next question after previous commit', async () => {
      const initialSession = {
        sessionId: 'daily_2026-10-09_test',
        uid: 'user_legit_4',
        status: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 0,
        totalXpEarned: 0,
        correctCount: 0,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        contentReleaseId: 'rel_v1_0_0',
      };

      const store = new MockFirestoreTransactionalStore(initialSession);
      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        store.createMockRunTransaction() as any
      );
      const repo = new FirestoreSessionRepository();

      // Submit Question 0 (q1)
      const res0 = await repo.recordAttemptAtomic({
        uid: 'user_legit_4',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q1',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
      });
      expect(res0.currentQuestionIndex).toBe(1);
      expect(res0.totalXpEarned).toBe(5);

      // Submit legitimate Question 1 (q2)
      const res1 = await repo.recordAttemptAtomic({
        uid: 'user_legit_4',
        sessionId: 'daily_2026-10-09_test',
        questionId: 'q2',
        questionIndex: 1,
        userAnswerPayload: { selected_option: 'option_c' },
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q2', feedback_html: '' },
      });
      expect(res1.currentQuestionIndex).toBe(2);
      expect(res1.totalXpEarned).toBe(10);
      expect(res1.correctCount).toBe(2);

      // Verify persisted state: accurately advanced to question index 2, 10 XP, 2 correct, 2 attempt docs
      const persisted = store.getSession();
      expect(persisted.currentQuestionIndex).toBe(2);
      expect(persisted.totalXpEarned).toBe(10);
      expect(persisted.correctCount).toBe(2);
      expect(store.getAttempts().size).toBe(2);

      runTransactionSpy.mockRestore();
    });

    it('5. rejects replayed requests after session completion and prevents any XP or count mutations', async () => {
      const completedSession = {
        sessionId: 'daily_2026-10-09_test',
        uid: 'user_replay_5',
        status: 'QUESTIONS_COMPLETED',
        questionsCompleted: true,
        currentQuestionIndex: 10,
        totalXpEarned: 50,
        correctCount: 10,
        questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
        contentReleaseId: 'rel_v1_0_0',
      };

      const store = new MockFirestoreTransactionalStore(completedSession);
      const runTransactionSpy = vi.spyOn(adminDb, 'runTransaction').mockImplementation(
        store.createMockRunTransaction() as any
      );
      const repo = new FirestoreSessionRepository();

      // Replay attempt on completed session
      await expect(
        repo.recordAttemptAtomic({
          uid: 'user_replay_5',
          sessionId: 'daily_2026-10-09_test',
          questionId: 'q10',
          questionIndex: 9,
          userAnswerPayload: { selected_option: 'option_d' },
          evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q10', feedback_html: '' },
        })
      ).rejects.toThrow('Daily session is already completed.');

      // Also verify replay when session status is REVIEW_COMPLETED
      store.sessionData.status = 'REVIEW_COMPLETED';
      await expect(
        repo.recordAttemptAtomic({
          uid: 'user_replay_5',
          sessionId: 'daily_2026-10-09_test',
          questionId: 'q1',
          questionIndex: 0,
          userAnswerPayload: { selected_option: 'option_a' },
          evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q1', feedback_html: '' },
        })
      ).rejects.toThrow('Daily session is already completed.');

      // Crucial: verify persisted session and attempt store are completely unmodified
      const persisted = store.getSession();
      expect(persisted.status).toBe('REVIEW_COMPLETED');
      expect(persisted.currentQuestionIndex).toBe(10);
      expect(persisted.totalXpEarned).toBe(50);
      expect(persisted.correctCount).toBe(10);
      expect(store.getAttempts().size).toBe(0);

      runTransactionSpy.mockRestore();
    });
  });

  // =========================================================================
  // RUNTIME CONTROLLER SANITIZATION & DTO STRIPPING
  // =========================================================================
  describe('SessionController Runtime Input Sanitization', () => {
    it('strips client-supplied isSessionComplete and unexpected fields before invoking use case', async () => {
      const recordAttemptSpy = vi.spyOn(defaultSessionUseCase, 'recordAttempt').mockResolvedValue({
        success: true,
        attemptId: 'att_123',
        evaluation: { is_correct: true, awarded_xp: 5, question_id: 'q0', feedback_html: '' },
      });

      const mockReq: any = {
        user: { uid: 'user_123' },
        body: {
          sessionId: 'session_abc',
          questionId: 'q0',
          questionIndex: 0,
          userAnswerPayload: { selected_option: 'option_a' },
          isSessionComplete: true, // Should be stripped
          hackerField: 'malicious', // Should be stripped
          forgedXp: 99999, // Should be stripped
        },
      };

      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockRes: any = { status: mockStatus };
      const mockNext = vi.fn();

      await SessionController.recordAttempt(mockReq, mockRes, mockNext);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(recordAttemptSpy).toHaveBeenCalledWith('user_123', {
        sessionId: 'session_abc',
        questionId: 'q0',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
      });

      const passedPayload = recordAttemptSpy.mock.calls[0][1] as any;
      expect(passedPayload.isSessionComplete).toBeUndefined();
      expect(passedPayload.hackerField).toBeUndefined();
      expect(passedPayload.forgedXp).toBeUndefined();

      recordAttemptSpy.mockRestore();
    });

    it('rejects missing sessionId with HTTP 400', async () => {
      const mockReq: any = {
        user: { uid: 'user_123' },
        body: { questionId: 'q0', questionIndex: 0, userAnswerPayload: {} },
      };
      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockRes: any = { status: mockStatus };

      await SessionController.recordAttempt(mockReq, mockRes, vi.fn());

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Session ID is required.' }));
    });

    it('rejects invalid or negative questionIndex with HTTP 400', async () => {
      const mockReq: any = {
        user: { uid: 'user_123' },
        body: { sessionId: 's1', questionId: 'q0', questionIndex: -1, userAnswerPayload: {} },
      };
      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockRes: any = { status: mockStatus };

      await SessionController.recordAttempt(mockReq, mockRes, vi.fn());

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({ error: 'Valid non-negative question index is required.' }));
    });

    it('translates question index mismatch error to HTTP 409 Conflict via errorHandler', async () => {
      const recordAttemptSpy = vi.spyOn(defaultSessionUseCase, 'recordAttempt').mockRejectedValue(
        new Error('Question index mismatch: expected question index 1, but received 0.')
      );

      const mockReq: any = {
        user: { uid: 'user_123' },
        body: {
          sessionId: 's1',
          questionId: 'q1',
          questionIndex: 0,
          userAnswerPayload: { selected_option: 'option_a' },
        },
      };
      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockRes: any = { status: mockStatus };

      const mockNext = vi.fn((err: any) => {
        errorHandler(err, mockReq, mockRes, vi.fn());
      });

      await SessionController.recordAttempt(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Question index mismatch'),
      }));

      recordAttemptSpy.mockRestore();
    });

    it('translates already completed session error to HTTP 409 Conflict via errorHandler', async () => {
      const recordAttemptSpy = vi.spyOn(defaultSessionUseCase, 'recordAttempt').mockRejectedValue(
        new Error('Daily session is already completed.')
      );

      const mockReq: any = {
        user: { uid: 'user_123' },
        body: {
          sessionId: 's1',
          questionId: 'q10',
          questionIndex: 9,
          userAnswerPayload: { selected_option: 'option_a' },
        },
      };
      const mockJson = vi.fn();
      const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
      const mockRes: any = { status: mockStatus };

      const mockNext = vi.fn((err: any) => {
        errorHandler(err, mockReq, mockRes, vi.fn());
      });

      await SessionController.recordAttempt(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Daily session is already completed.',
      }));

      recordAttemptSpy.mockRestore();
    });
  });
});
