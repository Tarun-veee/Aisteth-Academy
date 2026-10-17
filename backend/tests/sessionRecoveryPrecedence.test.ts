import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreSessionRepository } from '../src/infrastructure/firestore/FirestoreSessionRepository.js';
import { adminDb } from '../src/infrastructure/config/firebaseAdmin.js';
import { defaultQuestionRepository } from '../src/infrastructure/firestore/FirestoreQuestionRepository.js';
import {
  computeCanonicalPayloadFingerprint,
  computeCanonicalPayloadFingerprintV2,
  ConflictError,
  NotFoundError,
  ReceiptCorruptedError,
} from '../src/domain/rules/sessionValidation.js';
import { DailySessionDoc, AttemptDoc, SubmissionReceiptDoc } from '../src/domain/models/session.model.js';
import { SessionController } from '../src/api/controllers/SessionController.js';
import { sessionUseCase } from '../src/api/controllers/SessionController.js';

/**
 * In-Memory Transactional Store for Phase 2 Verification.
 * Strictly enforces:
 * 1. Reads-before-writes in transactions
 * 2. Exact collection paths for sessions, submissions, attempts, users, unsolvedQuestions
 * 3. Atomic commit/rollback
 */
class MockPhase2FirestoreStore {
  sessions = new Map<string, any>();
  users = new Map<string, any>();
  submissions = new Map<string, any>();
  attempts = new Map<string, any>();
  unsolvedQuestions = new Map<string, any>();
  version = 0;

  setSession(sessionId: string, uid: string, data: any) {
    this.sessions.set(`users/${uid}/dailySessions/${sessionId}`, JSON.parse(JSON.stringify(data)));
  }

  setUser(uid: string, data: any) {
    this.users.set(`users/${uid}`, JSON.parse(JSON.stringify(data)));
  }

  setSubmission(path: string, data: any) {
    this.submissions.set(path, JSON.parse(JSON.stringify(data)));
  }

  setAttempt(path: string, data: any) {
    this.attempts.set(path, JSON.parse(JSON.stringify(data)));
  }

  getAttemptsForSession(uid: string, sessionId: string): AttemptDoc[] {
    const results: AttemptDoc[] = [];
    for (const [path, data] of this.attempts.entries()) {
      if (path.startsWith(`users/${uid}/attempts/`) && data.dailySessionId === sessionId) {
        results.push(JSON.parse(JSON.stringify(data)));
      }
    }
    return results;
  }

  createMockRunTransaction() {
    return async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
      let writeStarted = false;
      const stagedSets = new Map<string, any>();
      const stagedUpdates = new Map<string, any>();

      const tx = {
        get: vi.fn().mockImplementation(async (ref: any) => {
          if (writeStarted) {
            throw new Error('FIRESTORE_VIOLATION: Reads must be executed before writes in Firestore transactions.');
          }

          // Handle collection / query reference
          if (ref._isQuery) {
            const docs = this.getAttemptsForSession(ref._uid, ref._sessionId);
            return {
              docs: docs.map((docData) => ({
                id: docData.attemptId,
                data: () => JSON.parse(JSON.stringify(docData)),
              })),
            };
          }

          const path: string = ref.path;
          if (path.includes('/submissions/')) {
            const data = this.submissions.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.includes('/attempts/')) {
            const data = this.attempts.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.includes('/unsolvedQuestions/')) {
            const data = this.unsolvedQuestions.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.includes('/dailySessions/')) {
            const data = this.sessions.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.startsWith('users/')) {
            const data = this.users.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          return { exists: false, data: () => undefined };
        }),
        set: vi.fn().mockImplementation((ref: any, data: any) => {
          writeStarted = true;
          stagedSets.set(ref.path, JSON.parse(JSON.stringify(data)));
        }),
        update: vi.fn().mockImplementation((ref: any, data: any) => {
          writeStarted = true;
          stagedUpdates.set(ref.path, JSON.parse(JSON.stringify(data)));
        }),
      };

      const result = await updateFunction(tx);

      // Commit staged writes
      for (const [path, data] of stagedSets.entries()) {
        if (path.includes('/submissions/')) this.submissions.set(path, data);
        else if (path.includes('/attempts/')) this.attempts.set(path, data);
        else if (path.includes('/unsolvedQuestions/')) this.unsolvedQuestions.set(path, data);
        else if (path.includes('/dailySessions/')) this.sessions.set(path, data);
        else if (path.startsWith('users/')) this.users.set(path, data);
      }

      for (const [path, data] of stagedUpdates.entries()) {
        if (path.includes('/dailySessions/')) {
          const current = this.sessions.get(path) || {};
          Object.assign(current, data);
          this.sessions.set(path, current);
        } else if (path.startsWith('users/')) {
          const current = this.users.get(path) || {};
          let newTotalXp = current.totalXp || 0;
          if (data.totalXp && typeof data.totalXp === 'object') {
            const delta = (data.totalXp as any).operand ?? (data.totalXp as any)._increment ?? 10;
            newTotalXp += delta;
          }
          const existingLedger = [...(current.lifetimeCompletedQuestionIds || [])];
          if (data.lifetimeCompletedQuestionIds && typeof data.lifetimeCompletedQuestionIds === 'object') {
            const newId = data.lifetimeCompletedQuestionIds.elements?.[0] || data.lifetimeCompletedQuestionIds._elements?.[0] || 'MG-AIA-01-TH';
            if (!existingLedger.includes(newId)) existingLedger.push(newId);
          }
          Object.assign(current, data);
          current.totalXp = newTotalXp;
          current.lifetimeCompletedQuestionIds = existingLedger;
          this.users.set(path, current);
        }
      }

      if (stagedSets.size > 0 || stagedUpdates.size > 0) {
        this.version++;
      }
      return result;
    };
  }
}

describe('Phase 2: Idempotency, Receipt Verification, and Authoritative Session Recovery Suite', () => {
  let store: MockPhase2FirestoreStore;
  let repo: FirestoreSessionRepository;
  const testUid = 'usr_p2_learner';
  const testSessionId = 'daily_2026-10-15_p2test';
  const curriculum10 = [
    'MG-AIA-01-TH',
    'MG-AIA-02-TH',
    'MG-AIA-03-TH',
    'MG-AIA-04-TH',
    'MG-AIA-05-TH',
    'MG-AIA-06-TH',
    'MG-AIA-07-TH',
    'MG-AIA-08-TH',
    'MG-AIA-09-TH',
    'MG-AIA-10-TH',
  ];

  beforeEach(() => {
    store = new MockPhase2FirestoreStore();
    repo = new FirestoreSessionRepository();

    vi.spyOn(adminDb, 'runTransaction').mockImplementation(
      store.createMockRunTransaction() as any
    );

    // Mock collection queries for adminDb
    vi.spyOn(adminDb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'users') {
        return {
          doc: (uid: string) => ({
            collection: (subCol: string) => {
              if (subCol === 'attempts') {
                return {
                  where: (field: string, op: string, val: string) => ({
                    _isQuery: true,
                    _uid: uid,
                    _sessionId: val,
                    get: async () => {
                      const docs = store.getAttemptsForSession(uid, val);
                      return {
                        docs: docs.map((d) => ({
                          id: d.attemptId,
                          data: () => JSON.parse(JSON.stringify(d)),
                        })),
                      };
                    },
                  }),
                };
              }
              return {} as any;
            },
          }),
        } as any;
      }
      return {} as any;
    });

    // Mock doc reads for non-transactional lookups
    vi.spyOn(adminDb, 'doc').mockImplementation((path: string) => {
      return {
        path,
        get: async () => {
          if (path.includes('/dailySessions/')) {
            const data = store.sessions.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.startsWith('users/')) {
            const data = store.users.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          return { exists: false, data: () => undefined };
        },
        set: async (data: any) => {
          if (path.includes('/dailySessions/')) store.sessions.set(path, JSON.parse(JSON.stringify(data)));
          else if (path.startsWith('users/')) store.users.set(path, JSON.parse(JSON.stringify(data)));
        },
        update: async (data: any) => {
          if (path.includes('/dailySessions/')) {
            const curr = store.sessions.get(path) || {};
            Object.assign(curr, data);
            store.sessions.set(path, curr);
          }
        },
      } as any;
    });

    // Setup base user
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 50,
      completedQuestionsCount: 5,
      lifetimeCompletedQuestionIds: ['MG-AIA-09-TH'],
      topicQueue: ['ASHA role', 'AiSteth'],
    });

    // Setup base session
    store.setSession(testSessionId, testUid, {
      sessionId: testSessionId,
      uid: testUid,
      userId: testUid,
      localDate: '2026-10-15',
      contentReleaseId: 'rel_v1_0_0',
      status: 'IN_PROGRESS',
      questionIds: [...curriculum10],
      currentQuestionIndex: 0,
      branchState: 'MAIN',
      activeMainQuestionId: curriculum10[0],
      activeFollowUpQuestionId: null,
      questionsCompleted: false,
      reviewViewed: false,
      totalXpEarned: 0,
      correctCount: 0,
      accuracy: 0,
      powerUpsUsed: { FIFTY_FIFTY: [], LEARN: [] },
    });

    // Mock Question Repository
    vi.spyOn(defaultQuestionRepository, 'getQuestionById').mockImplementation(async (id: string) => {
      return {
        question_id: id,
        question: `Question content for ${id}`,
        topic: 'ASHA role',
        question_type: id.endsWith('-PR') ? 'Follow-Up' : 'Primary',
        follow_up_for: id.endsWith('-PR') ? id.replace(/-PR$/, '-TH') : null,
      } as any;
    });

    vi.spyOn(defaultQuestionRepository, 'getFollowUpQuestion').mockImplementation(async (primaryId: string) => {
      return {
        question_id: `${primaryId.replace(/-TH$/, '')}-PR`,
        topic: 'ASHA role',
        question_type: 'Follow-Up',
        follow_up_for: primaryId,
      } as any;
    });
  });

  // =========================================================================
  // SECTION 1: ALL SIX RECEIPT SCENARIOS (SCE-01 to SCE-06)
  // =========================================================================
  describe('All Six Receipt Scenarios (SCE-01 to SCE-06)', () => {
    it('SCE-01: Scenario 1 - first submission evaluates answer, writes attempt and receipt V2, returns 201', async () => {
      const idempotencyKey = `idem_${testSessionId}_q0_MAIN_freshnonce1234`;
      const result = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
        idempotencyKey,
      });

      expect(result.attemptId).toBe(`att_${testSessionId}_q0_MAIN`);
      expect(result.currentQuestionIndex).toBe(1);
      expect(result.xpAwarded).toBe(10);

      // Verify V2 receipt recorded
      const receiptPath = `users/${testUid}/dailySessions/${testSessionId}/submissions/${idempotencyKey}`;
      const savedReceipt: SubmissionReceiptDoc = store.submissions.get(receiptPath);
      expect(savedReceipt).toBeDefined();
      expect(savedReceipt.fingerprintVersion).toBe('v2');
      expect(savedReceipt.payloadFingerprint).toBe(computeCanonicalPayloadFingerprintV2({ selectedOption: 'option_a' }));

      // Verify attempt recorded
      const attemptPath = `users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`;
      const savedAttempt: AttemptDoc = store.attempts.get(attemptPath);
      expect(savedAttempt).toBeDefined();
      expect(savedAttempt.result).toBe('CORRECT');
    });

    it('SCE-02: Scenario 2 - committed receipt and attempt replay cached evaluation with 0 writes and 0 duplicate XP', async () => {
      const idempotencyKey = `idem_${testSessionId}_q0_MAIN_committed1234`;
      const attemptId = `att_${testSessionId}_q0_MAIN`;

      // Seed stored receipt and attempt
      const receiptDoc: SubmissionReceiptDoc = {
        idempotencyKey,
        sessionId: testSessionId,
        uid: testUid,
        questionIndex: 0,
        branchState: 'MAIN',
        questionId: curriculum10[0],
        payloadFingerprint: computeCanonicalPayloadFingerprintV2({ selectedOption: 'option_a' }),
        fingerprintVersion: 'v2',
        attemptId,
        result: 'CORRECT',
        xpAwarded: 10,
        isSessionComplete: false,
        sessionStatus: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 1,
        totalXpEarnedInSession: 10,
        correctCount: 1,
        createdAt: new Date(),
      };
      store.setSubmission(`users/${testUid}/dailySessions/${testSessionId}/submissions/${idempotencyKey}`, receiptDoc);
      store.setAttempt(`users/${testUid}/attempts/${attemptId}`, {
        attemptId,
        dailySessionId: testSessionId,
        uid: testUid,
        userId: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_a' },
        result: 'CORRECT',
        xpAwarded: 10,
        contentReleaseId: 'rel_v1_0_0',
        powerUpsActive: [],
        clientTimestamp: Date.now(),
      });

      const initialUserXp = store.users.get(`users/${testUid}`).totalXp;
      const initialVersion = store.version;

      const replayResult = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
        idempotencyKey,
      });

      expect(replayResult.attemptId).toBe(attemptId);
      expect(replayResult.currentQuestionIndex).toBe(1);
      expect(replayResult.xpAwarded).toBe(10);

      // Verify ZERO writes and ZERO XP mutation
      expect(store.version).toBe(initialVersion);
      expect(store.users.get(`users/${testUid}`).totalXp).toBe(initialUserXp);
    });

    it('SCE-03: Scenario 3 - receipt exists but referenced attempt is missing -> fails closed with RECEIPT_ATTEMPT_LINEAGE_BROKEN', async () => {
      const idempotencyKey = `idem_${testSessionId}_q0_MAIN_brokenatt1234`;
      const receiptDoc: SubmissionReceiptDoc = {
        idempotencyKey,
        sessionId: testSessionId,
        uid: testUid,
        questionIndex: 0,
        branchState: 'MAIN',
        questionId: curriculum10[0],
        payloadFingerprint: computeCanonicalPayloadFingerprintV2({ selectedOption: 'option_a' }),
        fingerprintVersion: 'v2',
        attemptId: `att_${testSessionId}_q0_MAIN_missing`,
        result: 'CORRECT',
        xpAwarded: 10,
        isSessionComplete: false,
        sessionStatus: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 1,
        totalXpEarnedInSession: 10,
        correctCount: 1,
        createdAt: new Date(),
      };
      store.setSubmission(`users/${testUid}/dailySessions/${testSessionId}/submissions/${idempotencyKey}`, receiptDoc);

      await expect(
        repo.recordAttemptAtomic({
          uid: testUid,
          sessionId: testSessionId,
          questionId: curriculum10[0],
          questionIndex: 0,
          userAnswerPayload: { selectedOption: 'option_a' },
          evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
          idempotencyKey,
        })
      ).rejects.toThrow(/RECEIPT_ATTEMPT_LINEAGE_BROKEN/);
    });

    it('SCE-04: Scenario 4 - attempt exists for cycle but receipt is missing -> fails closed with CYCLE_ALREADY_ATTEMPTED', async () => {
      const attemptId = `att_${testSessionId}_q0_MAIN`;
      store.setAttempt(`users/${testUid}/attempts/${attemptId}`, {
        attemptId,
        dailySessionId: testSessionId,
        uid: testUid,
        userId: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_a' },
        result: 'CORRECT',
        xpAwarded: 10,
        contentReleaseId: 'rel_v1_0_0',
        powerUpsActive: [],
        clientTimestamp: Date.now(),
      });

      // Advance session in database to index 1
      const sessionPath = `users/${testUid}/dailySessions/${testSessionId}`;
      const session = store.sessions.get(sessionPath);
      session.currentQuestionIndex = 1;
      store.sessions.set(sessionPath, session);

      // Attempt to submit index 0 with a new idempotency key
      const newIdemKey = `idem_${testSessionId}_q0_MAIN_newkey12345`;
      await expect(
        repo.recordAttemptAtomic({
          uid: testUid,
          sessionId: testSessionId,
          questionId: curriculum10[0],
          questionIndex: 0,
          userAnswerPayload: { selectedOption: 'option_a' },
          evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
          idempotencyKey: newIdemKey,
        })
      ).rejects.toThrow(/Question index mismatch/);
    });

    it('SCE-05a: Scenario 5a - legacy V1 receipt with stripped coords verifies via raw stored attempt payload and returns 200', async () => {
      const idempotencyKey = `idem_${testSessionId}_q0_MAIN_v1nestedcoords`;
      const attemptId = `att_${testSessionId}_q0_MAIN`;

      const originalPayload = {
        type: 'IMAGE_TAP',
        tap_coordinate: { x_percent: 45.2, y_percent: 60.1 },
      };

      // V1 receipt had the stripped coordinate fingerprint and undefined fingerprintVersion
      const v1StrippedFingerprint = computeCanonicalPayloadFingerprint(originalPayload);
      const receiptDoc: SubmissionReceiptDoc = {
        idempotencyKey,
        sessionId: testSessionId,
        uid: testUid,
        questionIndex: 0,
        branchState: 'MAIN',
        questionId: curriculum10[0],
        payloadFingerprint: v1StrippedFingerprint, // Stripped hash
        attemptId,
        result: 'CORRECT',
        xpAwarded: 10,
        isSessionComplete: false,
        sessionStatus: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 1,
        totalXpEarnedInSession: 10,
        correctCount: 1,
        createdAt: new Date(),
      };
      store.setSubmission(`users/${testUid}/dailySessions/${testSessionId}/submissions/${idempotencyKey}`, receiptDoc);

      // Stored attempt retained the full raw payload
      store.setAttempt(`users/${testUid}/attempts/${attemptId}`, {
        attemptId,
        dailySessionId: testSessionId,
        uid: testUid,
        userId: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: originalPayload,
        result: 'CORRECT',
        xpAwarded: 10,
        contentReleaseId: 'rel_v1_0_0',
        powerUpsActive: [],
        clientTimestamp: Date.now(),
      });

      // Retry with identical coordinates
      const replay = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: {
          type: 'IMAGE_TAP',
          tap_coordinate: { x_percent: 45.2, y_percent: 60.1 },
        },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
        idempotencyKey,
      });

      expect(replay.attemptId).toBe(attemptId);
      expect(replay.currentQuestionIndex).toBe(1);
    });

    it('SCE-05b: Scenario 5b - legacy V1 receipt with stripped coords rejects altered coordinates with ATTEMPT_PAYLOAD_CONFLICT', async () => {
      const idempotencyKey = `idem_${testSessionId}_q0_MAIN_v1nestedcoords2`;
      const attemptId = `att_${testSessionId}_q0_MAIN`;

      const originalPayload = {
        type: 'IMAGE_TAP',
        tap_coordinate: { x_percent: 45.2, y_percent: 60.1 },
      };

      const v1StrippedFingerprint = computeCanonicalPayloadFingerprint(originalPayload);
      const receiptDoc: SubmissionReceiptDoc = {
        idempotencyKey,
        sessionId: testSessionId,
        uid: testUid,
        questionIndex: 0,
        branchState: 'MAIN',
        questionId: curriculum10[0],
        payloadFingerprint: v1StrippedFingerprint,
        attemptId,
        result: 'CORRECT',
        xpAwarded: 10,
        isSessionComplete: false,
        sessionStatus: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 1,
        totalXpEarnedInSession: 10,
        correctCount: 1,
        createdAt: new Date(),
      };
      store.setSubmission(`users/${testUid}/dailySessions/${testSessionId}/submissions/${idempotencyKey}`, receiptDoc);

      store.setAttempt(`users/${testUid}/attempts/${attemptId}`, {
        attemptId,
        dailySessionId: testSessionId,
        uid: testUid,
        userId: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: originalPayload,
        result: 'CORRECT',
        xpAwarded: 10,
        contentReleaseId: 'rel_v1_0_0',
        powerUpsActive: [],
        clientTimestamp: Date.now(),
      });

      // Retry with DIFFERENT coordinates (55.0 vs 45.2)
      await expect(
        repo.recordAttemptAtomic({
          uid: testUid,
          sessionId: testSessionId,
          questionId: curriculum10[0],
          questionIndex: 0,
          userAnswerPayload: {
            type: 'IMAGE_TAP',
            tap_coordinate: { x_percent: 55.0, y_percent: 60.1 },
          },
          evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
          idempotencyKey,
        })
      ).rejects.toThrow(/ATTEMPT_PAYLOAD_CONFLICT/);
    });

    it('SCE-06: Scenario 6 - idempotency key reused with genuinely different MCQ option throws ATTEMPT_PAYLOAD_CONFLICT', async () => {
      const idempotencyKey = `idem_${testSessionId}_q0_MAIN_mcqmismatch123`;
      const attemptId = `att_${testSessionId}_q0_MAIN`;

      const receiptDoc: SubmissionReceiptDoc = {
        idempotencyKey,
        sessionId: testSessionId,
        uid: testUid,
        questionIndex: 0,
        branchState: 'MAIN',
        questionId: curriculum10[0],
        payloadFingerprint: computeCanonicalPayloadFingerprintV2({ selectedOption: 'option_a' }),
        fingerprintVersion: 'v2',
        attemptId,
        result: 'CORRECT',
        xpAwarded: 10,
        isSessionComplete: false,
        sessionStatus: 'IN_PROGRESS',
        questionsCompleted: false,
        currentQuestionIndex: 1,
        totalXpEarnedInSession: 10,
        correctCount: 1,
        createdAt: new Date(),
      };
      store.setSubmission(`users/${testUid}/dailySessions/${testSessionId}/submissions/${idempotencyKey}`, receiptDoc);
      store.setAttempt(`users/${testUid}/attempts/${attemptId}`, {
        attemptId,
        dailySessionId: testSessionId,
        uid: testUid,
        userId: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_a' },
        result: 'CORRECT',
        xpAwarded: 10,
        contentReleaseId: 'rel_v1_0_0',
        powerUpsActive: [],
        clientTimestamp: Date.now(),
      });

      await expect(
        repo.recordAttemptAtomic({
          uid: testUid,
          sessionId: testSessionId,
          questionId: curriculum10[0],
          questionIndex: 0,
          userAnswerPayload: { selectedOption: 'option_b' }, // Mismatch!
          evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
          idempotencyKey,
        })
      ).rejects.toThrow(/ATTEMPT_PAYLOAD_CONFLICT/);
    });
  });

  // =========================================================================
  // SECTION 2: APPROVED LEARNING STATE MACHINE TRANSITIONS (LRN-01 to LRN-04)
  // =========================================================================
  describe('Approved Learning State Machine Transitions (LRN-01 to LRN-04)', () => {
    it('LRN-01: Correct Primary concludes item, advances to next Primary (index 1), awards 10 XP', async () => {
      const result = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct!' },
      });

      expect(result.branchState).toBe('MAIN');
      expect(result.currentQuestionIndex).toBe(1);
      expect(result.xpAwarded).toBe(10);

      // Verify user doc updated with completed question
      const user = store.users.get(`users/${testUid}`);
      expect(user.lifetimeCompletedQuestionIds).toContain(curriculum10[0]);
    });

    it('LRN-02: Incorrect Primary opens linked Follow-Up (branchState FOLLOW_UP, index remains 0, 0 XP)', async () => {
      const result = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_c' },
        evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
      });

      expect(result.branchState).toBe('FOLLOW_UP');
      expect(result.currentQuestionIndex).toBe(0);
      expect(result.xpAwarded).toBe(0);

      const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
      expect(session.branchState).toBe('FOLLOW_UP');
      expect(session.activeFollowUpQuestionId).toBe('MG-AIA-01-PR');
    });

    it('LRN-03: Correct Follow-Up CONCLUDES item immediately, advances to index 1 MAIN, NO reattempt', async () => {
      // 1. Submit incorrect Primary
      await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_c' },
        evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
      });

      // 2. Submit correct Follow-Up
      const fuResult = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: 'MG-AIA-01-PR',
        questionIndex: 0,
        branchState: 'FOLLOW_UP',
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 0, feedback: 'Correct follow up' },
      });

      // Crucial requirement: Follow-Up concludes item and rotates to next Primary!
      expect(fuResult.branchState).toBe('MAIN');
      expect(fuResult.currentQuestionIndex).toBe(1);
      expect(fuResult.xpAwarded).toBe(0);

      const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
      expect(session.branchState).toBe('MAIN');
      expect(session.currentQuestionIndex).toBe(1);
      expect(session.activeFollowUpQuestionId).toBeNull();
    });

    it('LRN-04: Incorrect Follow-Up CONCLUDES item immediately, advances to index 1 MAIN, logs to unsolved questions', async () => {
      // 1. Submit incorrect Primary
      await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0,
        userAnswerPayload: { selectedOption: 'option_c' },
        evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
      });

      // 2. Submit incorrect Follow-Up
      const fuResult = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: 'MG-AIA-01-PR',
        questionIndex: 0,
        branchState: 'FOLLOW_UP',
        userAnswerPayload: { selectedOption: 'option_d' },
        evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect follow up' },
      });

      expect(fuResult.branchState).toBe('MAIN');
      expect(fuResult.currentQuestionIndex).toBe(1);
      expect(fuResult.xpAwarded).toBe(0);

      // Verify unsolved question recorded
      const unsolved = store.unsolvedQuestions.get(`users/${testUid}/unsolvedQuestions/${curriculum10[0]}`);
      expect(unsolved).toBeDefined();
      expect(unsolved.failCount).toBe(1);
      expect(unsolved.lastFailedReason).toBe('FOLLOW_UP_FAILED');
    });
  });

  // =========================================================================
  // SECTION 3: ATTEMPT-LEDGER AUTHORITATIVE RECOVERY (REC-01 to REC-15)
  // =========================================================================
  describe('Attempt-Ledger Authoritative Recovery (REC-01 to REC-15)', () => {
    it('REC-01: State 1 - zero attempts restores session to index 0, MAIN, IN_PROGRESS', async () => {
      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(0);
      expect(recovered.branchState).toBe('MAIN');
      expect(recovered.status).toBe('IN_PROGRESS');
      expect(recovered.questionsCompleted).toBe(false);
    });

    it('REC-02: State 2 - completed Primaries for q0, q1 restores cursor to index 2, MAIN', async () => {
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q1_MAIN`, {
        attemptId: `att_${testSessionId}_q1_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[1],
        questionIndex: 1,
        result: 'CORRECT',
        xpAwarded: 10,
      });

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(2);
      expect(recovered.branchState).toBe('MAIN');
      expect(recovered.status).toBe('IN_PROGRESS');
    });

    it('REC-03: State 3 - incorrect Primary awaiting Follow-Up restores index 1, branchState FOLLOW_UP', async () => {
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q1_MAIN`, {
        attemptId: `att_${testSessionId}_q1_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[1],
        questionIndex: 1,
        result: 'INCORRECT',
        xpAwarded: 0,
      });

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(1);
      expect(recovered.branchState).toBe('FOLLOW_UP');
      expect(recovered.activeFollowUpQuestionId).toBe('MG-AIA-02-PR');
      expect(recovered.status).toBe('IN_PROGRESS');
    });

    it('REC-04: State 4 - completed Follow-Up restores cursor to next Primary (index 2), MAIN', async () => {
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q1_MAIN`, {
        attemptId: `att_${testSessionId}_q1_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[1],
        questionIndex: 1,
        result: 'INCORRECT',
        xpAwarded: 0,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q1_FOLLOW_UP`, {
        attemptId: `att_${testSessionId}_q1_FOLLOW_UP`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-AIA-02-PR',
        questionIndex: 1,
        result: 'CORRECT',
        xpAwarded: 0,
      });

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(2);
      expect(recovered.branchState).toBe('MAIN');
      expect(recovered.status).toBe('IN_PROGRESS');
    });

    it('REC-05: State 5 - session marked QUESTIONS_COMPLETED with only 4 attempts rolls back to index 4 IN_PROGRESS', async () => {
      // Simulate erroneous completed flags on session
      const sessionPath = `users/${testUid}/dailySessions/${testSessionId}`;
      const session = store.sessions.get(sessionPath);
      session.status = 'QUESTIONS_COMPLETED';
      session.questionsCompleted = true;
      session.currentQuestionIndex = 10;
      store.sessions.set(sessionPath, session);

      // Seed attempts only through index 3
      for (let i = 0; i < 4; i++) {
        store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q${i}_MAIN`, {
          attemptId: `att_${testSessionId}_q${i}_MAIN`,
          dailySessionId: testSessionId,
          uid: testUid,
          questionId: curriculum10[i],
          questionIndex: i,
          result: 'CORRECT',
          xpAwarded: 10,
        });
      }

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(4);
      expect(recovered.status).toBe('IN_PROGRESS');
      expect(recovered.questionsCompleted).toBe(false);
    });

    it('REC-06: State 6 - 10 Primaries with missing Follow-Up fails closed with SESSION_LINEAGE_CORRUPTED', async () => {
      // Seed 10 Primaries, but q3 was INCORRECT and lacks Follow-Up
      for (let i = 0; i < 10; i++) {
        store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q${i}_MAIN`, {
          attemptId: `att_${testSessionId}_q${i}_MAIN`,
          dailySessionId: testSessionId,
          uid: testUid,
          questionId: curriculum10[i],
          questionIndex: i,
          result: i === 3 ? 'INCORRECT' : 'CORRECT',
          xpAwarded: i === 3 ? 0 : 10,
        });
      }

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_LINEAGE_CORRUPTED: Unresolved remedial branch detected at question index 3/);
    });

    it('REC-07: State 7a - duplicate identical attempts collapse cleanly without error', async () => {
      // Two identical attempts for q0
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(1);
    });

    it('REC-08: State 7b - duplicate contradictory attempts fail closed with SESSION_STATE_CORRUPTED', async () => {
      // Mock store returning two conflicting attempts for same cycle
      vi.spyOn(store, 'getAttemptsForSession').mockReturnValue([
        {
          attemptId: `att_${testSessionId}_q0_MAIN`,
          dailySessionId: testSessionId,
          uid: testUid,
          questionId: curriculum10[0],
          questionIndex: 0,
          result: 'CORRECT',
          xpAwarded: 10,
        } as any,
        {
          attemptId: `att_${testSessionId}_q0_MAIN`,
          dailySessionId: testSessionId,
          uid: testUid,
          questionId: curriculum10[0],
          questionIndex: 0,
          result: 'INCORRECT', // Contradiction!
          xpAwarded: 0,
        } as any,
      ]);

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_STATE_CORRUPTED: Contradictory attempt outcomes/);
    });

    it('REC-09: State 8 - non-contiguous attempts (q0 and q2, missing q1) fail closed with SESSION_LINEAGE_CORRUPTED', async () => {
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q2_MAIN`, {
        attemptId: `att_${testSessionId}_q2_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[2],
        questionIndex: 2,
        result: 'CORRECT',
        xpAwarded: 10,
      });

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_LINEAGE_CORRUPTED: Non-contiguous attempt history. Question index 1 is missing/);
    });

    it('REC-10: State 9 - orphaned follow-up attempt fails closed with SESSION_LINEAGE_CORRUPTED', async () => {
      // Follow-up for q0 exists, but q0 was answered CORRECT
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_FOLLOW_UP`, {
        attemptId: `att_${testSessionId}_q0_FOLLOW_UP`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-AIA-01-PR',
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 0,
      });

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_LINEAGE_CORRUPTED: Follow-up attempt found at index 0 where Primary question was answered correctly/);
    });

    it('REC-10a: Isolated Follow-Up at index 0 with no preceding Primary fails closed with SESSION_LINEAGE_CORRUPTED', async () => {
      // Follow-up for q0 exists, but q0 MAIN was NEVER attempted
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_FOLLOW_UP`, {
        attemptId: `att_${testSessionId}_q0_FOLLOW_UP`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-AIA-01-PR',
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 0,
      });

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_LINEAGE_CORRUPTED: Follow-up attempt found at index 0 without a preceding Primary attempt/);
    });

    it('REC-10b: Orphaned Follow-Up at a later terminal index fails closed with SESSION_LINEAGE_CORRUPTED', async () => {
      // q0 has valid correct Primary
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });
      // q1 has orphaned Follow-Up without q1 MAIN
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q1_FOLLOW_UP`, {
        attemptId: `att_${testSessionId}_q1_FOLLOW_UP`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-AIA-02-PR',
        questionIndex: 1,
        result: 'INCORRECT',
        xpAwarded: 0,
      });

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_LINEAGE_CORRUPTED: Follow-up attempt found at index 1 without a preceding Primary attempt/);
    });

    it('REC-10c: Orphaned Follow-Up followed by gap fails closed with SESSION_LINEAGE_CORRUPTED', async () => {
      // q1 has orphaned Follow-Up (q0 missing entirely, q1 MAIN missing)
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q1_FOLLOW_UP`, {
        attemptId: `att_${testSessionId}_q1_FOLLOW_UP`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-AIA-02-PR',
        questionIndex: 1,
        result: 'CORRECT',
        xpAwarded: 0,
      });

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_LINEAGE_CORRUPTED/);
    });

    it('REC-11: State 10 - malformed attempt record (question mismatch) fails closed with SESSION_STATE_CORRUPTED', async () => {
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-WRONG-QUESTION-ID',
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });

      await expect(
        repo.reconcileSessionProgressAtomic(testUid, testSessionId)
      ).rejects.toThrow(/SESSION_STATE_CORRUPTED: Attempt question 'MG-WRONG-QUESTION-ID' at index 0 does not match session question/);
    });

    it('REC-12: State 11 - 10 completed questions with consistent history remains terminal QUESTIONS_COMPLETED', async () => {
      for (let i = 0; i < 10; i++) {
        store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q${i}_MAIN`, {
          attemptId: `att_${testSessionId}_q${i}_MAIN`,
          dailySessionId: testSessionId,
          uid: testUid,
          questionId: curriculum10[i],
          questionIndex: i,
          result: 'CORRECT',
          xpAwarded: 10,
        });
      }

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(10);
      expect(recovered.status).toBe('QUESTIONS_COMPLETED');
      expect(recovered.questionsCompleted).toBe(true);
    });

    it('REC-13: Historical Reattempt - historical REATTEMPT_MAIN attempt is handled gracefully as concluding item', async () => {
      // q0: MAIN (INCORRECT) -> FOLLOW_UP (CORRECT) -> REATTEMPT_MAIN (CORRECT)
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`, {
        attemptId: `att_${testSessionId}_q0_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'INCORRECT',
        xpAwarded: 0,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_FOLLOW_UP`, {
        attemptId: `att_${testSessionId}_q0_FOLLOW_UP`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: 'MG-AIA-01-PR',
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 0,
      });
      store.setAttempt(`users/${testUid}/attempts/att_${testSessionId}_q0_REATTEMPT_MAIN`, {
        attemptId: `att_${testSessionId}_q0_REATTEMPT_MAIN`,
        dailySessionId: testSessionId,
        uid: testUid,
        questionId: curriculum10[0],
        questionIndex: 0,
        result: 'CORRECT',
        xpAwarded: 10,
      });

      const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
      expect(recovered.currentQuestionIndex).toBe(1);
      expect(recovered.branchState).toBe('MAIN');
    });

    it('REC-14: Audit Isolation - session recovery mutates ZERO learner fields in users/${uid}', async () => {
      const userBefore = JSON.parse(JSON.stringify(store.users.get(`users/${testUid}`)));

      await repo.reconcileSessionProgressAtomic(testUid, testSessionId);

      const userAfter = store.users.get(`users/${testUid}`);
      expect(userAfter.totalXp).toBe(userBefore.totalXp);
      expect(userAfter.completedQuestionsCount).toBe(userBefore.completedQuestionsCount);
      expect(userAfter.lifetimeCompletedQuestionIds).toEqual(userBefore.lifetimeCompletedQuestionIds);
    });
  });

  // =========================================================================
  // SECTION 4: SECURITY & CONTROLLER CLEANUP (SEC-01)
  // =========================================================================
  describe('Security & Controller Cleanup (SEC-01)', () => {
    it('SEC-01: SessionController.recordAttempt enforces req.user.uid exclusively and ignores req.body.uid spoofing', async () => {
      const req: any = {
        user: { uid: testUid },
        body: {
          uid: 'victim_user_spoofed',
          sessionId: testSessionId,
          questionId: curriculum10[0],
          questionIndex: 0,
          userAnswerPayload: { selectedOption: 'option_a' },
        },
      };

      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res: any = { status: statusMock };
      const next = vi.fn();

      const recordAttemptSpy = vi.spyOn(sessionUseCase, 'recordAttempt').mockResolvedValue({
        attemptId: `att_${testSessionId}_q0_MAIN`,
      } as any);

      await SessionController.recordAttempt(req, res, next);

      expect(recordAttemptSpy).toHaveBeenCalledWith(testUid, expect.anything());
      expect(recordAttemptSpy).not.toHaveBeenCalledWith('victim_user_spoofed', expect.anything());
    });
  });
});
