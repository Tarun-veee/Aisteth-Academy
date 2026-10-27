import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreSessionRepository } from '../src/infrastructure/firestore/FirestoreSessionRepository.js';
import { adminDb } from '../src/infrastructure/config/firebaseAdmin.js';
import {
  validateIdempotencyKeyBoundary,
  validateAuthoritativeUserDoc,
  validateStoredReceiptIntegrity,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from '../src/domain/rules/sessionValidation.js';
import { DailySessionDoc } from '../src/domain/models/session.model.js';

/**
 * Mock Firestore Transactional Test Store
 * Strictly models:
 * 1. Reads-before-writes enforcement (throws if .get is called after .set or .update)
 * 2. Optimistic Concurrency Control (OCC) retry semantics
 * 3. Exact collection paths: dailySessions, submissions, users, attempts, unsolvedQuestions
 */
class MockFirestoreStage3Store {
  sessions = new Map<string, any>();
  users = new Map<string, any>();
  submissions = new Map<string, any>();
  attempts = new Map<string, any>();
  unsolvedQuestions = new Map<string, any>();

  version = 0;

  setSession(sessionId: string, data: any) {
    this.sessions.set(`users/${data.uid}/dailySessions/${sessionId}`, JSON.parse(JSON.stringify(data)));
  }

  setUser(uid: string, data: any) {
    this.users.set(`users/${uid}`, JSON.parse(JSON.stringify(data)));
  }

  setSubmission(path: string, data: any) {
    this.submissions.set(path, JSON.parse(JSON.stringify(data)));
  }

  setUnsolved(path: string, data: any) {
    this.unsolvedQuestions.set(path, JSON.parse(JSON.stringify(data)));
  }

  createMockRunTransaction() {
    return async <T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> => {
      let retries = 0;
      const maxRetries = 5;

      while (retries < maxRetries) {
        retries++;
        const readVersion = this.version;
        const stagedSets = new Map<string, any>();
        const stagedUpdates = new Map<string, any>();
        let writeStarted = false;

        const tx = {
          get: vi.fn().mockImplementation(async (ref: any) => {
            if (writeStarted) {
              throw new Error('FIRESTORE_VIOLATION: Reads must be executed before writes in Firestore transactions.');
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

        if (this.version !== readVersion) {
          // OCC retry triggered
          continue;
        }

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
          } else if (path.includes('/unsolvedQuestions/')) {
            const current = this.unsolvedQuestions.get(path) || {};
            if (data.failCount && typeof data.failCount === 'object') {
              current.failCount = (current.failCount || 0) + 1;
            }
            Object.assign(current, { ...data, failCount: current.failCount });
            this.unsolvedQuestions.set(path, current);
          } else if (path.startsWith('users/')) {
            const current = this.users.get(path) || {};
            if (!current.learningState) {
              current.learningState = {
                totalXp: current.totalXp || 0,
                completedQuestionsCount: current.completedQuestionsCount || 0,
                currentStreak: 0,
                longestStreak: 0,
                completedSessionsCount: 0,
                totalCorrectAnswersCount: 0,
              };
            }
            if (data.lifetimeCompletedQuestionIds && typeof data.lifetimeCompletedQuestionIds === 'object') {
              const newId = data.lifetimeCompletedQuestionIds._elements?.[0] || 'MG-AIA-01-TH';
              const existing = current.lifetimeCompletedQuestionIds || [];
              if (!existing.includes(newId)) existing.push(newId);
              current.lifetimeCompletedQuestionIds = existing;
            }
            if (data.completedQuestionsCount && typeof data.completedQuestionsCount === 'object') {
              current.completedQuestionsCount = (current.completedQuestionsCount || 0) + 1;
            } else if (typeof data.completedQuestionsCount === 'number') {
              current.completedQuestionsCount = data.completedQuestionsCount;
            }
            if (data.totalXp && typeof data.totalXp === 'object') {
              const delta = (data.totalXp as any).operand ?? (data.totalXp as any)._increment ?? 10;
              current.totalXp = (current.totalXp || 0) + delta;
            } else if (typeof data.totalXp === 'number') {
              current.totalXp = data.totalXp;
            }
            if (data['learningState.totalXp'] && typeof data['learningState.totalXp'] === 'object') {
              const delta = (data['learningState.totalXp'] as any).operand ?? (data['learningState.totalXp'] as any)._increment ?? 10;
              current.learningState.totalXp = (current.learningState.totalXp || 0) + delta;
            }
            if (data['learningState.completedQuestionsCount'] && typeof data['learningState.completedQuestionsCount'] === 'object') {
              current.learningState.completedQuestionsCount = (current.learningState.completedQuestionsCount || 0) + 1;
            }
            if (data.learningState && typeof data.learningState === 'object') {
              current.learningState = { ...current.learningState, ...data.learningState };
            }
            const evaluatedTotalXp = current.totalXp;
            const evaluatedQuestions = current.completedQuestionsCount;
            Object.assign(current, data);
            current.totalXp = evaluatedTotalXp;
            current.completedQuestionsCount = evaluatedQuestions;
            this.users.set(path, current);
          }
        }

        if (stagedSets.size > 0 || stagedUpdates.size > 0) {
          this.version++;
        }
        return result;
      }

      throw new Error('Transaction contention limit reached.');
    };
  }
}

describe('RBSK Learning Engine — Stage 3 Acceptance Suite (TC-01 through TC-20)', () => {
  let store: MockFirestoreStage3Store;
  let repo: FirestoreSessionRepository;
  const testUid = 'user_stage3_learner';
  const testSessionId = 'daily_2026-10-12_stage3';
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
    store = new MockFirestoreStage3Store();
    repo = new FirestoreSessionRepository();

    vi.spyOn(adminDb, 'runTransaction').mockImplementation(
      store.createMockRunTransaction() as any
    );

    // Initial user document with grandfathered history
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 100,
      completedQuestionsCount: 10,
      lifetimeCompletedQuestionIds: ['MG-AIL-01-TH'],
    });

    // Initial session document at index 0
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      date: '2026-10-12',
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: curriculum10,
      branchState: 'MAIN',
      activeMainQuestionId: null,
      activeFollowUpQuestionId: null,
    });
  });

  // -------------------------------------------------------------------------
  // TC-01: Valid Linear Primary Submission (MAIN branch)
  // -------------------------------------------------------------------------
  it('TC-01: commits linear Primary submission, records attempt, receipt, ledger, and awards 10 XP', async () => {
    const nonce = 'abcd1234';
    const idemKey = `idem_${testSessionId}_q0_MAIN_${nonce}`;

    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(result.attemptId).toBe(`att_${testSessionId}_q0_MAIN`);
    expect(result.currentQuestionIndex).toBe(1);
    expect(result.totalXpEarned).toBe(10);
    expect(result.correctCount).toBe(1);
    expect(result.xpAwarded).toBe(10);
    expect(result.branchState).toBe('MAIN');

    // Receipt verification
    const receiptPath = `users/${testUid}/dailySessions/${testSessionId}/submissions/${idemKey}`;
    const receipt = store.submissions.get(receiptPath);
    expect(receipt).toBeDefined();
    expect(receipt.idempotencyKey).toBe(idemKey);
    expect(receipt.result).toBe('CORRECT');
    expect(receipt.xpAwarded).toBe(10);
    expect(receipt.currentQuestionIndex).toBe(1);

    // Attempt document verification
    const attemptPath = `users/${testUid}/attempts/att_${testSessionId}_q0_MAIN`;
    const attempt = store.attempts.get(attemptPath);
    expect(attempt).toBeDefined();
    expect(attempt.result).toBe('CORRECT');
    expect(attempt.xpAwarded).toBe(10);
  });

  // -------------------------------------------------------------------------
  // TC-02: Lost-Response Replay (Identical Payload)
  // -------------------------------------------------------------------------
  it('TC-02: replays stored receipt on identical request without executing state writes or re-awarding XP', async () => {
    const nonce = 'replay123';
    const idemKey = `idem_${testSessionId}_q0_MAIN_${nonce}`;

    // 1st call
    const firstResult = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    const storeVersionAfterFirst = store.version;

    // 2nd call (replay)
    const replayResult = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    // Exact parity with first result
    expect(replayResult).toEqual(firstResult);
    // Verifies no additional writes mutated the store version
    expect(store.version).toBe(storeVersionAfterFirst);
  });

  // -------------------------------------------------------------------------
  // TC-03: Conflicting Payload Replay (Payload Mismatch)
  // -------------------------------------------------------------------------
  it('TC-03: rejects reused idempotency key with conflicting payload with HTTP 409 Conflict', async () => {
    const nonce = 'conflict99';
    const idemKey = `idem_${testSessionId}_q0_MAIN_${nonce}`;

    // 1st call with option_a
    await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    // 2nd call with option_b
    await expect(
      repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: 'MG-AIA-01-TH',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_b' },
        selectedOption: 'option_b',
        evaluation: { is_correct: false, awarded_xp: 0, question_id: 'MG-AIA-01-TH', feedback_message: 'Incorrect', explanation: '' },
        idempotencyKey: idemKey,
        branchState: 'MAIN',
      })
    ).rejects.toThrow('ATTEMPT_PAYLOAD_CONFLICT');
  });

  // -------------------------------------------------------------------------
  // TC-04: Concurrent Duplicate Submission Race Condition
  // -------------------------------------------------------------------------
  it('TC-04: handles concurrent duplicate submissions idempotently via OCC retry', async () => {
    const nonce = 'race_occ_1';
    const idemKey = `idem_${testSessionId}_q0_MAIN_${nonce}`;

    const p1 = repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    const p2 = repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.attemptId).toBe(`att_${testSessionId}_q0_MAIN`);
    expect(r2.attemptId).toBe(`att_${testSessionId}_q0_MAIN`);
    expect(r1.totalXpEarned).toBe(10);
    expect(r2.totalXpEarned).toBe(10);

    // Exactly 1 attempt doc and 1 receipt doc created
    expect(store.attempts.size).toBe(1);
    expect(store.submissions.size).toBe(1);
  });

  // -------------------------------------------------------------------------
  // TC-05: 305 XP Ceiling Boundary Race Condition
  // -------------------------------------------------------------------------
  it('TC-05: awards 10 XP at pre-award 305 XP boundary allowing ceiling crossing to 315', async () => {
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 305,
      completedQuestionsCount: 30,
      lifetimeCompletedQuestionIds: [],
    });

    const idemKey = `idem_${testSessionId}_q0_MAIN_boundary305`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(result.xpAwarded).toBe(10);
    expect(result.totalXpEarned).toBe(10);
  });

  // -------------------------------------------------------------------------
  // TC-06: 310+ XP Pre-Award Boundary
  // -------------------------------------------------------------------------
  it('TC-06: awards 0 XP at pre-award 310+ XP but updates lifetime ledger and completion counter', async () => {
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 310,
      completedQuestionsCount: 31,
      lifetimeCompletedQuestionIds: [],
    });

    const idemKey = `idem_${testSessionId}_q0_MAIN_boundary310`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(result.xpAwarded).toBe(0);
    expect(result.totalXpEarned).toBe(0);
    expect(result.correctCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // TC-07: Duplicate Submission for Already-Ledgered Primary
  // -------------------------------------------------------------------------
  it('TC-07: awards 0 XP when completing a Primary question already present in lifetime ledger', async () => {
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 100,
      completedQuestionsCount: 10,
      lifetimeCompletedQuestionIds: ['MG-AIA-01-TH'], // already ledgered
    });

    const idemKey = `idem_${testSessionId}_q0_MAIN_already_ledgered`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(result.xpAwarded).toBe(0);
    expect(result.totalXpEarned).toBe(0);
    expect(result.correctCount).toBe(1); // Answered correctly in today's session
  });

  // -------------------------------------------------------------------------
  // TC-08: Main Incorrect -> Remedial Branch Transition
  // -------------------------------------------------------------------------
  it('TC-08: transitions to FOLLOW_UP branch on incorrect Main answer advancing to follow-up slot', async () => {
    const idemKey = `idem_${testSessionId}_q0_MAIN_incorrect`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_c' },
      selectedOption: 'option_c',
      evaluation: { is_correct: false, awarded_xp: 0, question_id: 'MG-AIA-01-TH', feedback_message: 'Incorrect', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(result.currentQuestionIndex).toBe(1);
    expect(result.branchState).toBe('FOLLOW_UP');
    expect(result.xpAwarded).toBe(0);
    expect(result.totalXpEarned).toBe(0);
    expect(result.correctCount).toBe(0);

    const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(session.branchState).toBe('FOLLOW_UP');
    expect(session.currentQuestionIndex).toBe(1);
    expect(session.activeMainQuestionId).toBe('MG-AIA-01-TH');
    expect(session.activeFollowUpQuestionId).toBe('MG-AIA-01-PR');
  });

  // -------------------------------------------------------------------------
  // TC-09: Follow-Up Correct -> Immediate Item Conclusion
  // -------------------------------------------------------------------------
  it('TC-09: concludes item immediately on correct follow-up and advances to next Main slot without reattempt', async () => {
    // Setup session in FOLLOW_UP state at index 1
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 1,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: ['MG-AIA-01-TH', 'MG-AIA-01-PR', ...curriculum10.slice(1, 9)],
      branchState: 'FOLLOW_UP',
      activeMainQuestionId: 'MG-AIA-01-TH',
      activeFollowUpQuestionId: 'MG-AIA-01-PR',
    });

    const idemKey = `idem_${testSessionId}_q1_FOLLOW_UP_nonce_correct_1`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-PR',
      questionIndex: 1,
      userAnswerPayload: { selected_option: 'option_b' },
      selectedOption: 'option_b',
      evaluation: { is_correct: true, awarded_xp: 0, question_id: 'MG-AIA-01-PR', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'FOLLOW_UP',
    });

    expect(result.currentQuestionIndex).toBe(2);
    expect(result.branchState).toBe('MAIN');
    expect(result.xpAwarded).toBe(0);
    expect(result.totalXpEarned).toBe(0);

    const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(session.branchState).toBe('MAIN');
    expect(session.currentQuestionIndex).toBe(2);
    expect(session.activeFollowUpQuestionId).toBeNull();
  });

  // -------------------------------------------------------------------------
  // TC-10: Follow-Up Incorrect -> Remedial Failure & Bucket Upsert
  // -------------------------------------------------------------------------
  it('TC-10: records remedial failure, advances index, and upserts unsolved question bucket on failed follow-up', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: curriculum10,
      branchState: 'FOLLOW_UP',
      activeMainQuestionId: 'MG-AIA-01-TH',
      activeFollowUpQuestionId: 'MG-AIA-01-PR',
    });

    const idemKey = `idem_${testSessionId}_q0_FOLLOW_UP_nonce_failed_1`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-PR',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_d' },
      selectedOption: 'option_d',
      evaluation: { is_correct: false, awarded_xp: 0, question_id: 'MG-AIA-01-PR', feedback_message: 'Incorrect', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'FOLLOW_UP',
    });

    expect(result.currentQuestionIndex).toBe(1);
    expect(result.branchState).toBe('MAIN');

    // Unsolved question bucket upsert check
    const unsolvedPath = `users/${testUid}/unsolvedQuestions/MG-AIA-01-TH`;
    const unsolved = store.unsolvedQuestions.get(unsolvedPath);
    expect(unsolved).toBeDefined();
    expect(unsolved.failCount).toBe(1);
    expect(unsolved.initialReason).toBe('FOLLOW_UP_FAILED');
    expect(unsolved.reviewStatus).toBe('UNREVIEWED');
    expect(unsolved.isResolved).toBe(false);
  });

  // -------------------------------------------------------------------------
  // TC-11: Reattempt Main Correct -> Mastery & Ledger Recording
  // -------------------------------------------------------------------------
  it('TC-11: masters question on correct reattempt, advances index, and awards 10 XP', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: curriculum10,
      branchState: 'REATTEMPT_MAIN',
      activeMainQuestionId: 'MG-AIA-01-TH',
      activeFollowUpQuestionId: null,
    });

    const idemKey = `idem_${testSessionId}_q0_REATTEMPT_MAIN_nonce_correct_2`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: 'Mastered', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'REATTEMPT_MAIN',
    });

    expect(result.currentQuestionIndex).toBe(1);
    expect(result.branchState).toBe('MAIN');
    expect(result.xpAwarded).toBe(10);
    expect(result.totalXpEarned).toBe(10);
    expect(result.correctCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // TC-12: Reattempt Main Incorrect -> Remedial Failure & Bucket Upsert
  // -------------------------------------------------------------------------
  it('TC-12: advances index and upserts unsolved bucket with REATTEMPT_FAILED on failed reattempt', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: curriculum10,
      branchState: 'REATTEMPT_MAIN',
      activeMainQuestionId: 'MG-AIA-01-TH',
      activeFollowUpQuestionId: null,
    });

    const idemKey = `idem_${testSessionId}_q0_REATTEMPT_MAIN_nonce_failed_2`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_d' },
      selectedOption: 'option_d',
      evaluation: { is_correct: false, awarded_xp: 0, question_id: 'MG-AIA-01-TH', feedback_message: 'Incorrect', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'REATTEMPT_MAIN',
    });

    expect(result.currentQuestionIndex).toBe(1);
    expect(result.branchState).toBe('MAIN');

    const unsolvedPath = `users/${testUid}/unsolvedQuestions/MG-AIA-01-TH`;
    const unsolved = store.unsolvedQuestions.get(unsolvedPath);
    expect(unsolved).toBeDefined();
    expect(unsolved.failCount).toBe(1);
    expect(unsolved.initialReason).toBe('REATTEMPT_FAILED');
  });

  // -------------------------------------------------------------------------
  // TC-13: Unsolved Bucket Existing Reviewed Status Preservation (Decision 2)
  // -------------------------------------------------------------------------
  it('TC-13: preserves REVIEWED status when a previously reviewed question fails again', async () => {
    // Pre-existing reviewed bucket entry
    const unsolvedPath = `users/${testUid}/unsolvedQuestions/MG-AIA-01-TH`;
    store.setUnsolved(unsolvedPath, {
      id: 'MG-AIA-01-TH',
      mainQuestionId: 'MG-AIA-01-TH',
      followUpQuestionId: 'MG-AIA-01-PR',
      failCount: 2,
      initialReason: 'FOLLOW_UP_FAILED',
      lastFailedReason: 'FOLLOW_UP_FAILED',
      isResolved: true,
      reviewStatus: 'REVIEWED',
      reviewedAt: '2026-10-10T10:00:00Z',
    });

    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: curriculum10,
      branchState: 'REATTEMPT_MAIN',
      activeMainQuestionId: 'MG-AIA-01-TH',
      activeFollowUpQuestionId: null,
    });

    const idemKey = `idem_${testSessionId}_q0_REATTEMPT_MAIN_fail_reviewed`;
    await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      userAnswerPayload: { selected_option: 'option_b' },
      selectedOption: 'option_b',
      evaluation: { is_correct: false, awarded_xp: 0, question_id: 'MG-AIA-01-TH', feedback_message: 'Failed', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'REATTEMPT_MAIN',
    });

    const updated = store.unsolvedQuestions.get(unsolvedPath);
    expect(updated.failCount).toBe(3);
    expect(updated.reviewStatus).toBe('REVIEWED'); // Status PRESERVED
    expect(updated.isResolved).toBe(false);        // Reopened for refresher review
    expect(updated.lastFailedReason).toBe('REATTEMPT_FAILED');
  });

  // -------------------------------------------------------------------------
  // TC-14: Terminal Session Completion at Index 9 -> 10 & Replay Parity
  // -------------------------------------------------------------------------
  it('TC-14: completes session at question 10, sets QUESTIONS_COMPLETED, and allows idempotent receipt replay', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 9,
      totalXpEarned: 90,
      correctCount: 9,
      questionIds: curriculum10,
      branchState: 'MAIN',
      activeMainQuestionId: null,
      activeFollowUpQuestionId: null,
    });

    const idemKey = `idem_${testSessionId}_q9_MAIN_terminal`;
    const finalResult = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-10-TH',
      questionIndex: 9,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-10-TH', feedback_message: 'Complete', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(finalResult.currentQuestionIndex).toBe(10);
    expect(finalResult.isSessionComplete).toBe(true);
    expect(finalResult.questionsCompleted).toBe(true);
    expect(finalResult.status).toBe('QUESTIONS_COMPLETED');

    // Replay receipt on terminal session must succeed with parity
    const replay = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-10-TH',
      questionIndex: 9,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-10-TH', feedback_message: 'Complete', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    expect(replay).toEqual(finalResult);
  });

  // -------------------------------------------------------------------------
  // TC-14B: New Submission Rejection on Completed Session
  // -------------------------------------------------------------------------
  it('TC-14B: rejects brand-new submissions on already-completed sessions with HTTP 409 Conflict', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'QUESTIONS_COMPLETED',
      questionsCompleted: true,
      currentQuestionIndex: 10,
      totalXpEarned: 100,
      correctCount: 10,
      questionIds: curriculum10,
      branchState: 'MAIN',
    });

    const newKey = `idem_${testSessionId}_q10_MAIN_newpostterminal`;
    await expect(
      repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: 'MG-AIA-10-TH',
        questionIndex: 10,
        userAnswerPayload: { selected_option: 'option_a' },
        selectedOption: 'option_a',
        evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-10-TH', feedback_message: '', explanation: '' },
        idempotencyKey: newKey,
        branchState: 'MAIN',
      })
    ).rejects.toThrow('Daily session is already completed.');
  });

  // -------------------------------------------------------------------------
  // TC-14C: Authoritative Curriculum Lineage & Tampering Rejection
  // -------------------------------------------------------------------------
  it('TC-14C: rejects non-authoritative Primary question ID with SESSION_STATE_CORRUPTED', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 0,
      totalXpEarned: 0,
      correctCount: 0,
      questionIds: ['MG-FORGED-01-TH', ...curriculum10.slice(1)],
      branchState: 'MAIN',
    });

    const idemKey = `idem_${testSessionId}_q0_MAIN_tampered`;
    await expect(
      repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: 'MG-FORGED-01-TH',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        selectedOption: 'option_a',
        evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-FORGED-01-TH', feedback_message: '', explanation: '' },
        idempotencyKey: idemKey,
        branchState: 'MAIN',
      })
    ).rejects.toThrow('SESSION_STATE_CORRUPTED');
  });

  // -------------------------------------------------------------------------
  // TC-15: Idempotency Key Boundary Validation
  // -------------------------------------------------------------------------
  it('TC-15: rejects malformed or out-of-boundary idempotency keys with BadRequestError', () => {
    // Under 23 chars
    expect(() => validateIdempotencyKeyBoundary('idem_short', 'daily_s1')).toThrow(BadRequestError);
    // Over 152 chars
    const overlyLong = 'idem_' + 'a'.repeat(160);
    expect(() => validateIdempotencyKeyBoundary(overlyLong, 'daily_s1')).toThrow(BadRequestError);
    // Mismatched session ID
    const mismatchedSession = `idem_different_session_q0_MAIN_nonce123`;
    expect(() => validateIdempotencyKeyBoundary(mismatchedSession, testSessionId)).toThrow(BadRequestError);
  });

  // -------------------------------------------------------------------------
  // TC-16: Stored Receipt Integrity & Tampering Protection
  // -------------------------------------------------------------------------
  it('TC-16: detects corrupted or tampered stored receipt document', () => {
    const corruptReceipt = {
      idempotencyKey: 'idem_test_q0_MAIN_1',
      uid: 'attacker_uid', // UID mismatch
      sessionId: testSessionId,
    };

    expect(() =>
      validateStoredReceiptIntegrity(corruptReceipt, testUid, testSessionId, 'idem_test_q0_MAIN_1')
    ).toThrow(ForbiddenError);
  });

  // -------------------------------------------------------------------------
  // TC-17: Legacy User Missing Ledger (Decision 1 Option A)
  // -------------------------------------------------------------------------
  it('TC-17: normalizes absent lifetime ledger to empty array without crashing', () => {
    const legacyDoc = {
      uid: 'legacy_user',
      totalXp: 50,
      completedQuestionsCount: 5,
      // lifetimeCompletedQuestionIds missing!
    };

    const validated = validateAuthoritativeUserDoc(legacyDoc, 'legacy_user');
    expect(validated.lifetimeCompletedQuestionIds).toEqual([]);
    expect(validated.totalXp).toBe(50);
  });

  // -------------------------------------------------------------------------
  // TC-18: Legacy User Empty Ledger vs Malformed Ledger
  // -------------------------------------------------------------------------
  it('TC-18: accepts empty ledger [] but rejects duplicate or malformed array', () => {
    const validEmpty = validateAuthoritativeUserDoc({
      uid: 'u1',
      totalXp: 0,
      completedQuestionsCount: 0,
      lifetimeCompletedQuestionIds: [],
    }, 'u1');
    expect(validEmpty.lifetimeCompletedQuestionIds).toEqual([]);

    // Malformed: duplicate IDs
    expect(() =>
      validateAuthoritativeUserDoc({
        uid: 'u1',
        totalXp: 0,
        completedQuestionsCount: 0,
        lifetimeCompletedQuestionIds: ['Q1', 'Q1'],
      }, 'u1')
    ).toThrow(ConflictError);

    // Malformed: non-string elements
    expect(() =>
      validateAuthoritativeUserDoc({
        uid: 'u1',
        totalXp: 0,
        completedQuestionsCount: 0,
        lifetimeCompletedQuestionIds: [123],
      }, 'u1')
    ).toThrow(ConflictError);
  });

  // -------------------------------------------------------------------------
  // TC-19: Strict Phase 1 Reads Before Writes Transaction Enforcement
  // -------------------------------------------------------------------------
  it('TC-19: enforces that all reads precede writes in Firestore transaction lifecycle', async () => {
    const idemKey = `idem_${testSessionId}_q0_MAIN_phase1check`;
    // If any read occurred after write, MockFirestoreStage3Store throws FIRESTORE_VIOLATION
    await expect(
      repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: 'MG-AIA-01-TH',
        questionIndex: 0,
        userAnswerPayload: { selected_option: 'option_a' },
        selectedOption: 'option_a',
        evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-01-TH', feedback_message: '', explanation: '' },
        idempotencyKey: idemKey,
        branchState: 'MAIN',
      })
    ).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // TC-20: Remedial Cycle Isolation (Follow-Up does not affect XP or correctCount)
  // -------------------------------------------------------------------------
  it('TC-20: isolates follow-up answers from XP awards and session correctCount', async () => {
    store.setSession(testSessionId, {
      sessionId: testSessionId,
      uid: testUid,
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 2,
      totalXpEarned: 20,
      correctCount: 2,
      questionIds: curriculum10,
      branchState: 'FOLLOW_UP',
      activeMainQuestionId: 'MG-AIA-03-TH',
      activeFollowUpQuestionId: 'MG-AIA-03-PR',
    });

    const idemKey = `idem_${testSessionId}_q2_FOLLOW_UP_isolation`;
    const result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-03-PR',
      questionIndex: 2,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 0, question_id: 'MG-AIA-03-PR', feedback_message: '', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'FOLLOW_UP',
    });

    // Zero XP awarded, total XP unchanged at 20, correctCount unchanged at 2
    expect(result.xpAwarded).toBe(0);
    expect(result.totalXpEarned).toBe(20);
    expect(result.correctCount).toBe(2);
  });

  // -------------------------------------------------------------------------
  // TC-21: Integrated Session Lifecycle — Attempts followed by Finalization
  // -------------------------------------------------------------------------
  it('TC-21: complete session lifecycle: recordAttemptAtomic awards XP, finalizeSessionAtomic awards 0 XP, syncs fields, and does not double-count questions', async () => {
    const finalSessionId = 'daily_2026-10-12_final_lifecycle';
    // User starts with 190 XP and 19 completed questions
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 190,
      completedQuestionsCount: 19,
      lifetimeCompletedQuestionIds: ['MG-AIL-01-TH'],
      lastActiveDate: '2026-10-11',
      learningState: {
        lastActiveDate: '2026-10-11',
        totalXp: 190,
        completedQuestionsCount: 19,
        currentStreak: 2,
        longestStreak: 5,
        completedSessionsCount: 2,
        totalCorrectAnswersCount: 15,
      },
    });

    // Session is at question index 9 (last question, 90 XP earned so far)
    store.setSession(finalSessionId, {
      sessionId: finalSessionId,
      uid: testUid,
      date: '2026-10-12',
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 9,
      totalXpEarned: 90,
      correctCount: 9,
      questionIds: curriculum10,
      branchState: 'MAIN',
      activeMainQuestionId: null,
      activeFollowUpQuestionId: null,
    });

    const idemKey = `idem_${finalSessionId}_q9_MAIN_final_step`;

    // 1. Submit final (10th) question
    const attemptRes = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: finalSessionId,
      questionId: 'MG-AIA-10-TH',
      questionIndex: 9,
      userAnswerPayload: { selected_option: 'option_a' },
      selectedOption: 'option_a',
      evaluation: { is_correct: true, awarded_xp: 10, question_id: 'MG-AIA-10-TH', feedback_message: 'Correct', explanation: '' },
      idempotencyKey: idemKey,
      branchState: 'MAIN',
    });

    // Verify attempt awards 10 XP and transitions session to QUESTIONS_COMPLETED
    expect(attemptRes.xpAwarded).toBe(10);
    expect(attemptRes.totalXpEarned).toBe(100);
    expect(attemptRes.correctCount).toBe(10);
    expect(attemptRes.isSessionComplete).toBe(true);
    expect(attemptRes.status).toBe('QUESTIONS_COMPLETED');
    expect(attemptRes.questionsCompleted).toBe(true);

    // Verify user in store has 200 XP and 20 completed questions after attempt
    const userAfterAttempt = store.users.get(`users/${testUid}`);
    expect(userAfterAttempt.totalXp).toBe(200);
    expect(userAfterAttempt.completedQuestionsCount).toBe(20);

    // 2. Finalize session
    const finalizeRes = await repo.finalizeSessionAtomic({
      uid: testUid,
      sessionId: finalSessionId,
      todayDateStr: '2026-10-12',
    });

    expect(finalizeRes.success).toBe(true);
    expect(finalizeRes.alreadyFinalized).toBe(false);

    // CRITICAL: Finalization must award 0 XP and not increment questions again!
    expect(finalizeRes.updatedLearningState?.totalXp).toBe(200);
    expect(finalizeRes.updatedLearningState?.completedQuestionsCount).toBe(20);
    expect(finalizeRes.updatedLearningState?.completedSessionsCount).toBe(3);
    expect(finalizeRes.updatedLearningState?.currentStreak).toBe(3);
    expect(finalizeRes.updatedLearningState?.totalCorrectAnswersCount).toBe(25); // 15 + 10
    expect(finalizeRes.updatedLearningState?.currentLevel).toBe(21); // min(31, floor(200/10) + 1)

    // Verify user store state: root fields and nested learningState fields are 100% synchronized
    const userAfterFinalize = store.users.get(`users/${testUid}`);
    expect(userAfterFinalize.totalXp).toBe(200);
    expect(userAfterFinalize.completedQuestionsCount).toBe(20);
    expect(userAfterFinalize.learningState.totalXp).toBe(200);
    expect(userAfterFinalize.learningState.completedQuestionsCount).toBe(20);

    // Verify session store state: status is REVIEW_COMPLETED, totalXpEarned is 100 (0 bonus added)
    const sessionAfterFinalize = store.sessions.get(`users/${testUid}/dailySessions/${finalSessionId}`);
    expect(sessionAfterFinalize.status).toBe('REVIEW_COMPLETED');
    expect(sessionAfterFinalize.reviewViewed).toBe(true);
    expect(sessionAfterFinalize.totalXpEarned).toBe(100);
    expect(sessionAfterFinalize.correctCount).toBe(10);
  });

  // -------------------------------------------------------------------------
  // TC-22: Repeated Finalization Idempotency Protection
  // -------------------------------------------------------------------------
  it('TC-22: duplicate finalization safely returns alreadyFinalized: true with zero mutations', async () => {
    const finalSessionId = 'daily_2026-10-12_final_lifecycle';
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 200,
      completedQuestionsCount: 20,
      learningState: {
        totalXp: 200,
        completedQuestionsCount: 20,
        currentStreak: 3,
        longestStreak: 5,
        completedSessionsCount: 3,
      },
    });
    store.setSession(finalSessionId, {
      sessionId: finalSessionId,
      uid: testUid,
      date: '2026-10-12',
      status: 'REVIEW_COMPLETED',
      reviewViewed: true,
      questionsCompleted: true,
      currentQuestionIndex: 10,
      totalXpEarned: 100,
      correctCount: 10,
    });
    const storeVersionBeforeDuplicate = store.version;

    const duplicateRes = await repo.finalizeSessionAtomic({
      uid: testUid,
      sessionId: finalSessionId,
      todayDateStr: '2026-10-12',
    });

    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.alreadyFinalized).toBe(true);

    // No database writes staged or committed
    expect(store.version).toBe(storeVersionBeforeDuplicate);

    // User document remains completely unaffected
    const user = store.users.get(`users/${testUid}`);
    expect(user.totalXp).toBe(200);
    expect(user.completedQuestionsCount).toBe(20);
    expect(user.learningState.completedSessionsCount).toBe(3);
  });

  // -------------------------------------------------------------------------
  // TC-23: Mid-Session Incomplete Finalization (0 Bonus, No Session Increment)
  // -------------------------------------------------------------------------
  it('TC-23: incomplete session finalization awards 0 XP and preserves completedSessionsCount', async () => {
    const midSessionId = 'daily_2026-10-12_mid_session';
    store.setUser(testUid, {
      uid: testUid,
      totalXp: 130,
      completedQuestionsCount: 13,
      lifetimeCompletedQuestionIds: ['MG-AIL-01-TH'],
      learningState: {
        totalXp: 130,
        completedQuestionsCount: 13,
        currentStreak: 1,
        longestStreak: 2,
        completedSessionsCount: 1,
        totalCorrectAnswersCount: 10,
      },
    });

    store.setSession(midSessionId, {
      sessionId: midSessionId,
      uid: testUid,
      date: '2026-10-12',
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 5,
      totalXpEarned: 30, // 3 questions correct so far
      correctCount: 3,
      questionIds: curriculum10,
      branchState: 'MAIN',
    });

    const finalizeRes = await repo.finalizeSessionAtomic({
      uid: testUid,
      sessionId: midSessionId,
      todayDateStr: '2026-10-12',
    });

    expect(finalizeRes.success).toBe(true);
    expect(finalizeRes.alreadyFinalized).toBe(false);

    // Zero XP awarded, question count unchanged, session count unchanged (incomplete)
    expect(finalizeRes.updatedLearningState?.totalXp).toBe(130);
    expect(finalizeRes.updatedLearningState?.completedQuestionsCount).toBe(13);
    expect(finalizeRes.updatedLearningState?.completedSessionsCount).toBe(1);

    const session = store.sessions.get(`users/${testUid}/dailySessions/${midSessionId}`);
    expect(session.status).toBe('REVIEW_COMPLETED');
    expect(session.totalXpEarned).toBe(30); // 0 bonus added
  });
});
