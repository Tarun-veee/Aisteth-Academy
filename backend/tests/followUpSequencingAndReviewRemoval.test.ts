import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreSessionRepository } from '../src/infrastructure/firestore/FirestoreSessionRepository.js';
import { adminDb } from '../src/infrastructure/config/firebaseAdmin.js';
import { defaultQuestionRepository } from '../src/infrastructure/firestore/FirestoreQuestionRepository.js';
import {
  ConflictError,
  NotFoundError,
} from '../src/domain/rules/sessionValidation.js';
import { DailySessionDoc, AttemptDoc } from '../src/domain/models/session.model.js';
import {
  getDailyCycleDate,
  getResolvedCalendarDate,
  CANONICAL_31_TOPIC_SEQUENCE,
} from '../src/domain/rules/sessionSelection.js';
import { SessionUseCase } from '../src/application/usecases/SessionUseCase.js';

/**
 * Mock Firestore transactional store for testing authoritative FirestoreSessionRepository behavior
 */
class MockFirestoreStore {
  sessions = new Map<string, any>();
  users = new Map<string, any>();
  submissions = new Map<string, any>();
  attempts = new Map<string, any>();
  unsolvedQuestions = new Map<string, any>();

  setSession(sessionId: string, uid: string, data: any) {
    this.sessions.set(`users/${uid}/dailySessions/${sessionId}`, JSON.parse(JSON.stringify(data)));
  }

  setUser(uid: string, data: any) {
    this.users.set(`users/${uid}`, JSON.parse(JSON.stringify(data)));
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
          Object.assign(current, {
            ...data,
            totalXp: typeof data.totalXp === 'number' ? data.totalXp : newTotalXp,
            lifetimeCompletedQuestionIds: existingLedger,
          });
          this.users.set(path, current);
        }
      }

      return result;
    };
  }
}

describe('Follow-Up Sequencing and Daily Reset Verification (Part A & Part C)', () => {
  let store: MockFirestoreStore;
  let repo: FirestoreSessionRepository;
  const testUid = 'user_seq_test_001';
  const testSessionId = 'daily_2026-10-19_session';

  const curriculum10 = [
    'MG-AIA-01-TH', // Q1
    'MG-AIA-02-TH', // Q2
    'MG-AIA-03-TH', // Q3
    'MG-AIA-04-TH', // Q4
    'MG-AIA-05-TH', // Q5
    'MG-AIA-06-TH', // Q6
    'MG-AIA-07-TH', // Q7
    'MG-AIA-08-TH', // Q8
    'MG-AIA-09-TH', // Q9
    'MG-AIA-10-TH', // Q10
  ];

  beforeEach(() => {
    store = new MockFirestoreStore();
    repo = new FirestoreSessionRepository();

    vi.spyOn(adminDb, 'runTransaction').mockImplementation(store.createMockRunTransaction());
    vi.spyOn(adminDb, 'collection').mockImplementation((path: string) => {
      if (path === 'users') {
        return {
          doc: (uid: string) => ({
            collection: (sub: string) => {
              if (sub === 'attempts') {
                return {
                  where: (_field: string, _op: string, val: string) => ({
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

    vi.spyOn(adminDb, 'doc').mockImplementation((path: string) => {
      return {
        path,
        get: async () => {
          if (path.includes('/submissions/')) {
            const data = store.submissions.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.includes('/attempts/')) {
            const data = store.attempts.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
          if (path.includes('/unsolvedQuestions/')) {
            const data = store.unsolvedQuestions.get(path);
            return data ? { exists: true, data: () => JSON.parse(JSON.stringify(data)) } : { exists: false, data: () => undefined };
          }
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
        collection: (sub: string) => ({
          path: `${path}/${sub}`,
          where: () => ({
            _isQuery: true,
            _uid: testUid,
            _sessionId: testSessionId,
            orderBy: () => ({
              _isQuery: true,
              _uid: testUid,
              _sessionId: testSessionId,
            }),
          }),
        }),
      } as any;
    });

    store.setUser(testUid, {
      uid: testUid,
      totalXp: 100,
      completedQuestionsCount: 10,
      lifetimeCompletedQuestionIds: [],
      topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
      learningState: {
        totalXp: 100,
        completedQuestionsCount: 10,
      },
    });

    store.setSession(testSessionId, testUid, {
      sessionId: testSessionId,
      uid: testUid,
      userId: testUid,
      localDate: '2026-10-19',
      contentReleaseId: 'rel_v1_0_0',
      status: 'IN_PROGRESS',
      questionIds: [...curriculum10],
      currentQuestionIndex: 0,
      questionsCompleted: false,
      reviewViewed: false,
      totalXpEarned: 0,
      correctCount: 0,
      accuracy: 0,
      powerUpsUsed: { FIFTY_FIFTY: [], LEARN: [] },
      branchState: 'MAIN',
      activeMainQuestionId: null,
      activeFollowUpQuestionId: null,
      rotatedQuestionIndices: [],
    });

    vi.spyOn(defaultQuestionRepository, 'getFollowUpQuestion').mockImplementation(async (primaryId: string) => {
      const fuId = primaryId.replace(/-TH$/, '-PR');
      return {
        question_id: fuId,
        question_type: 'Follow-Up',
        follow_up_for: primaryId,
        topic: 'Ai Abnormal',
        difficulty_rank: 1,
        question: `Follow-up for ${primaryId}`,
        correct_option: 'option_a',
      } as any;
    });

    vi.spyOn(defaultQuestionRepository, 'getQuestionById').mockImplementation(async (id: string) => {
      const isFu = id.endsWith('-PR');
      return {
        question_id: id,
        question_type: isFu ? 'Follow-Up' : 'Primary',
        follow_up_for: isFu ? id.replace(/-PR$/, '-TH') : null,
        topic: 'Ai Abnormal',
        difficulty_rank: 1,
        question: `Question ${id}`,
        correct_option: 'option_a',
      } as any;
    });
  });

  // TEST 1 — PARTIAL COMPLETION: Primary Question 4 answered incorrectly -> Follow-Up is Question 5
  it('TEST 1: Primary Question 4 answered incorrectly assigns Follow-Up to Question 5 (index 4)', async () => {
    // Answer Q1, Q2, Q3 correctly
    for (let i = 0; i < 3; i++) {
      await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[i],
        questionIndex: i,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
      });
    }

    // Now at Question 4 (index 3), answer incorrectly
    const q4Result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[3],
      questionIndex: 3,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    // Required: Follow-Up occupies next sequence position (index 4 = Question 5)
    expect(q4Result.branchState).toBe('FOLLOW_UP');
    expect(q4Result.currentQuestionIndex).toBe(4);
    expect(q4Result.activeFollowUpQuestionId).toBe('MG-AIA-04-PR');

    const updatedSession = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(updatedSession.currentQuestionIndex).toBe(4);
    expect(updatedSession.branchState).toBe('FOLLOW_UP');
    expect(updatedSession.activeFollowUpQuestionId).toBe('MG-AIA-04-PR');
    expect(updatedSession.activeMainQuestionId).toBe('MG-AIA-04-TH');
    // Total sequence length remains capped at 10 slots
    expect(updatedSession.questionIds.length).toBe(10);
    expect(updatedSession.questionIds[4]).toBe('MG-AIA-04-PR');
  });

  // TEST 2 — COMPLETION: Follow-Up completed -> next Primary is Question 6
  it('TEST 2: Follow-Up completed at Question 5 advances to next eligible Primary at Question 6 (index 5)', async () => {
    // Complete Q1-Q3 correct, Q4 incorrect
    for (let i = 0; i < 3; i++) {
      await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[i],
        questionIndex: i,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
      });
    }
    await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[3],
      questionIndex: 3,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    // Now answer Follow-Up at Question 5 (index 4)
    const fuResult = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-04-PR',
      questionIndex: 4,
      branchState: 'FOLLOW_UP',
      userAnswerPayload: { selectedOption: 'option_a' },
      evaluation: { is_correct: true, awarded_xp: 0, feedback: 'Follow-Up completed' },
    });

    // Required: Next question is Question 6 (index 5), branchState returns to MAIN
    expect(fuResult.branchState).toBe('MAIN');
    expect(fuResult.currentQuestionIndex).toBe(5);

    const updatedSession = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(updatedSession.currentQuestionIndex).toBe(5);
    expect(updatedSession.branchState).toBe('MAIN');
    expect(updatedSession.activeFollowUpQuestionId).toBeNull();
    // Question at index 5 is the next eligible Primary (curriculum10[4] = MG-AIA-05-TH)
    expect(updatedSession.questionIds[5]).toBe('MG-AIA-05-TH');
  });

  // TEST 2b — SPECIFIC USER SCENARIO: Main Question 2 answered incorrectly -> Follow-Up is Question 3 -> Next Main is Question 4
  it('TEST 2b: Main Question 2 answered incorrectly -> linked Follow-Up is Question 3 (index 2), then completed -> next Main is Question 4 (index 3)', async () => {
    // Answer Q1 correctly (index 0)
    await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[0],
      questionIndex: 0,
      userAnswerPayload: { selectedOption: 'option_a' },
      evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
    });

    // Answer Main Question 2 incorrectly (index 1)
    const q2Result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[1],
      questionIndex: 1,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    // Sequence check: Follow-Up must occupy Question 3 of 10 (index 2)
    expect(q2Result.branchState).toBe('FOLLOW_UP');
    expect(q2Result.currentQuestionIndex).toBe(2);
    expect(q2Result.activeFollowUpQuestionId).toBe('MG-AIA-02-PR');

    const sessionAtQ3 = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(sessionAtQ3.currentQuestionIndex).toBe(2); // Sequence slot 3
    expect(sessionAtQ3.branchState).toBe('FOLLOW_UP');
    expect(sessionAtQ3.questionIds[2]).toBe('MG-AIA-02-PR');
    expect(sessionAtQ3.questionIds.length).toBe(10); // Still 10 slots

    // Answer Follow-Up at Question 3 (index 2)
    const fuResult = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-02-PR',
      questionIndex: 2,
      branchState: 'FOLLOW_UP',
      userAnswerPayload: { selectedOption: 'option_a' },
      evaluation: { is_correct: true, awarded_xp: 0, feedback: 'Follow-Up finished' },
    });

    // Sequence check: Next question is Question 4 of 10 (index 3)
    expect(fuResult.branchState).toBe('MAIN');
    expect(fuResult.currentQuestionIndex).toBe(3);

    const sessionAtQ4 = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(sessionAtQ4.currentQuestionIndex).toBe(3); // Sequence slot 4
    expect(sessionAtQ4.branchState).toBe('MAIN');
    expect(sessionAtQ4.activeFollowUpQuestionId).toBeNull();
    // Question at index 3 is next eligible Primary (curriculum10[2] = MG-AIA-03-TH)
    expect(sessionAtQ4.questionIds[3]).toBe('MG-AIA-03-TH');
  });

  // TEST 2c — END-TO-END USE CASE RECONCILIATION: Reproduces and verifies resolution of the MG-AIS-01-PR vs MG-AIS-01-TH mismatch
  it('TEST 2c: SessionUseCase.recordAttempt preserves MG-AIS-01-PR on FOLLOW_UP branch without mutating to parent MG-AIS-01-TH', async () => {
    const useCase = new SessionUseCase(repo, defaultQuestionRepository);
    const canonicalSessionId = useCase.generateCanonicalSessionId(testUid, '2026-10-19');

    // Mock question repo to resolve AiSteth questions
    vi.spyOn(defaultQuestionRepository, 'getQuestionById').mockImplementation(async (id: string) => {
      if (id === 'MG-AIS-01-PR') {
        return {
          question_id: 'MG-AIS-01-PR',
          question_type: 'Follow-Up',
          type: 'MCQ',
          follow_up_for: 'MG-AIS-01-TH',
          topic: 'AiSteth',
          difficulty_rank: 1,
          question: 'You are at a village health camp. The AiSteth LED is blinking blue. What should you do?',
          options: {
            option_a: 'Charge the device.',
            option_b: 'Wait for the device to connect to your phone.',
            option_c: 'Start using the device immediately.',
            option_d: 'Check the battery level.',
          },
          correct_answer: 'option_b',
          correct_option: 'option_b',
          explanation: 'Wait for the device to connect.',
        } as any;
      }
      if (id === 'MG-AIS-01-TH') {
        return {
          question_id: 'MG-AIS-01-TH',
          question_type: 'Primary',
          type: 'MCQ',
          follow_up_for: null,
          topic: 'AiSteth',
          difficulty_rank: 1,
          question: 'The LED on the AiSteth is blinking blue. What is the device doing?',
          options: {
            option_a: 'The device is charging',
            option_b: 'The device is connecting to a phone',
            option_c: 'The device is off',
            option_d: 'The device is broken',
          },
          correct_answer: 'option_b',
          correct_option: 'option_b',
          explanation: 'Blinking blue means connecting.',
        } as any;
      }
      const isFu = id.endsWith('-PR');
      return {
        question_id: id,
        question_type: isFu ? 'Follow-Up' : 'Primary',
        type: 'MCQ',
        follow_up_for: isFu ? id.replace(/-PR$/, '-TH') : null,
        topic: 'AiSteth',
        difficulty_rank: 1,
        question: `Question ${id}`,
        options: { option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' },
        correct_answer: 'option_a',
        correct_option: 'option_a',
      } as any;
    });

    vi.spyOn(defaultQuestionRepository, 'getFollowUpQuestion').mockImplementation(async (primaryId: string) => {
      if (primaryId === 'MG-AIS-01-TH') {
        return defaultQuestionRepository.getQuestionById('MG-AIS-01-PR');
      }
      return defaultQuestionRepository.getQuestionById(`${primaryId.replace('-TH', '')}-PR`);
    });

    // 1. Session starts at Question 1 (index 0) with primary MG-AIS-01-TH at Question 2
    store.setSession(canonicalSessionId, testUid, {
      sessionId: canonicalSessionId,
      uid: testUid,
      userId: testUid,
      localDate: '2026-10-19',
      contentReleaseId: 'rel_v1_0_0',
      status: 'IN_PROGRESS',
      questionIds: ['MG-AIA-01-TH', 'MG-AIS-01-TH', 'MG-AIA-03-TH', 'MG-AIA-04-TH', 'MG-AIA-05-TH', 'MG-AIA-06-TH', 'MG-AIA-07-TH', 'MG-AIA-08-TH', 'MG-AIA-09-TH', 'MG-AIA-10-TH'],
      currentQuestionIndex: 0,
      questionsCompleted: false,
      reviewViewed: false,
      totalXpEarned: 0,
      correctCount: 0,
      accuracy: 0,
      powerUpsUsed: { FIFTY_FIFTY: [], LEARN: [] },
      branchState: 'MAIN',
      activeMainQuestionId: null,
      activeFollowUpQuestionId: null,
    });

    // 2. Trainee answers Question 1 correctly
    await useCase.recordAttempt(testUid, {
      sessionId: canonicalSessionId,
      questionId: 'MG-AIA-01-TH',
      questionIndex: 0,
      branchState: 'MAIN',
      userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      selectedOption: 'option_a',
      idempotencyKey: `idem_${canonicalSessionId}_q0_MAIN_testnonce123456`,
    });

    // 3. Trainee answers Main Question 2 incorrectly via useCase.recordAttempt
    const q2Attempt = await useCase.recordAttempt(testUid, {
      sessionId: canonicalSessionId,
      questionId: 'MG-AIS-01-TH',
      questionIndex: 1,
      branchState: 'MAIN',
      userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      selectedOption: 'option_a',
      idempotencyKey: `idem_${canonicalSessionId}_q1_MAIN_testnonce123456`,
    });

    expect(q2Attempt.branchState).toBe('FOLLOW_UP');
    expect(q2Attempt.currentQuestionIndex).toBe(2);
    expect(q2Attempt.activeFollowUpQuestionId).toBe('MG-AIS-01-PR');

    // Verify session state in store has MG-AIS-01-PR at index 2 (Question 3 of 10)
    const sessionAfterQ2 = store.sessions.get(`users/${testUid}/dailySessions/${canonicalSessionId}`);
    expect(sessionAfterQ2.currentQuestionIndex).toBe(2);
    expect(sessionAfterQ2.branchState).toBe('FOLLOW_UP');
    expect(sessionAfterQ2.activeFollowUpQuestionId).toBe('MG-AIS-01-PR');
    expect(sessionAfterQ2.questionIds[2]).toBe('MG-AIS-01-PR');

    // 3. Trainee refreshes or reloads: getOrCreateTodaySession must NOT corrupt index 2 back to MG-AIS-01-TH
    const recovered = await useCase.getOrCreateTodaySession(testUid, '2026-10-19');
    expect(recovered.session.currentQuestionIndex).toBe(2);
    expect(recovered.session.branchState).toBe('FOLLOW_UP');
    expect(recovered.session.questionIds[2]).toBe('MG-AIS-01-PR');

    // 4. Trainee submits answer to Question 3 (MG-AIS-01-PR, selected_option 'option_c' as in user's screenshot)
    // Previously, this failed with "expected follow-up question MG-AIS-01-PR at index 2, but received MG-AIS-01-TH."
    const fuAttempt = await useCase.recordAttempt(testUid, {
      sessionId: canonicalSessionId,
      questionId: 'MG-AIS-01-PR',
      questionIndex: 2,
      branchState: 'FOLLOW_UP',
      userAnswerPayload: { type: 'MCQ', selected_option: 'option_c' },
      selectedOption: 'option_c',
      idempotencyKey: `idem_${canonicalSessionId}_q2_FOLLOW_UP_testnonce123456`,
    });

    // Verification: attempt succeeds without throwing conflict error
    expect(fuAttempt.success).toBe(true);
    expect(fuAttempt.result).toBe('INCORRECT'); // Option C was incorrect
    // Advances to Question 4 of 10 (index 3) on MAIN branch
    expect(fuAttempt.currentQuestionIndex).toBe(3);
    expect(fuAttempt.branchState).toBe('MAIN');

    // Verify final session state: sequence slot 4 is ready for the next eligible Primary
    const sessionAfterFu = store.sessions.get(`users/${testUid}/dailySessions/${canonicalSessionId}`);
    expect(sessionAfterFu.currentQuestionIndex).toBe(3);
    expect(sessionAfterFu.branchState).toBe('MAIN');
    expect(sessionAfterFu.activeFollowUpQuestionId).toBeNull();
    expect(sessionAfterFu.questionIds[3]).toBe('MG-AIA-03-TH');
  });

  // TEST 3 — NEXT CYCLE / CORRECT PATH: Primary Question 4 answered correctly -> next Primary is Question 5
  it('TEST 3: Primary Question 4 answered correctly -> next Primary is Question 5 without Follow-Up', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[i],
        questionIndex: i,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
      });
      if (i === 3) {
        expect(res.branchState).toBe('MAIN');
        expect(res.currentQuestionIndex).toBe(4);
      }
    }

    const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(session.currentQuestionIndex).toBe(4);
    expect(session.branchState).toBe('MAIN');
    expect(session.questionIds[4]).toBe('MG-AIA-05-TH');
  });

  // TEST 4 — FOLLOW-UP OCCUPYING SLOT 10: daily sequence ends correctly
  it('TEST 4: Follow-Up occupying Slot 10 (index 9) ends daily sequence at 10 slots with QUESTIONS_COMPLETED', async () => {
    // Complete Q1-Q8 correctly
    for (let i = 0; i < 8; i++) {
      await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[i],
        questionIndex: i,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
      });
    }

    // Question 9 (index 8): Primary answered incorrectly -> Follow-Up becomes Slot 10 (index 9)
    const q9Result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[8],
      questionIndex: 8,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    expect(q9Result.currentQuestionIndex).toBe(9);
    expect(q9Result.branchState).toBe('FOLLOW_UP');

    // Slot 10 (index 9): Follow-Up answered
    const slot10Result = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-09-PR',
      questionIndex: 9,
      branchState: 'FOLLOW_UP',
      userAnswerPayload: { selectedOption: 'option_a' },
      evaluation: { is_correct: true, awarded_xp: 0, feedback: 'Done' },
    });

    expect(slot10Result.isSessionComplete).toBe(true);
    expect(slot10Result.status).toBe('QUESTIONS_COMPLETED');
    expect(slot10Result.questionsCompleted).toBe(true);
    expect(slot10Result.currentQuestionIndex).toBe(10);

    const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(session.status).toBe('QUESTIONS_COMPLETED');
    expect(session.questionsCompleted).toBe(true);
    expect(session.questionIds.length).toBe(10);
  });

  // TEST 5 — REFRESH / RECOVERY: Preserves Follow-Up sequence position
  it('TEST 5: Refresh and session recovery preserves Follow-Up sequence position at index 4', async () => {
    // Complete Q1-Q3 correct, Q4 incorrect
    for (let i = 0; i < 3; i++) {
      await repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[i],
        questionIndex: i,
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
      });
    }
    await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[3],
      questionIndex: 3,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    // Reconcile session progress
    const recovered = await repo.reconcileSessionProgressAtomic(testUid, testSessionId);
    expect(recovered.currentQuestionIndex).toBe(4);
    expect(recovered.branchState).toBe('FOLLOW_UP');
    expect(recovered.activeFollowUpQuestionId).toBe('MG-AIA-04-PR');
  });

  // TEST 6 — DUPLICATE SUBMISSIONS: Repeated submissions do not create duplicate Follow-Ups
  it('TEST 6: Replay of failed Primary with idempotency key does not duplicate Follow-Up or advance sequence', async () => {
    const idemKey = `idem_${testSessionId}_q0_MAIN_testnonce`;

    const res1 = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[0],
      questionIndex: 0,
      idempotencyKey: idemKey,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    expect(res1.currentQuestionIndex).toBe(1);
    expect(res1.branchState).toBe('FOLLOW_UP');

    // Replay exact same request
    const res2 = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[0],
      questionIndex: 0,
      idempotencyKey: idemKey,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    expect(res2.currentQuestionIndex).toBe(1);
    expect(res2.branchState).toBe('FOLLOW_UP');

    const session = store.sessions.get(`users/${testUid}/dailySessions/${testSessionId}`);
    expect(session.currentQuestionIndex).toBe(1);
    expect(session.questionIds.length).toBe(10);
  });

  // TEST 7 — CONCURRENCY: Simultaneous requests around cycle transition do not cause inconsistent state
  it('TEST 7: Concurrent requests maintain atomic ordering and do not corrupt slots', async () => {
    const idem1 = `idem_${testSessionId}_q0_MAIN_nonce12345`;
    const p1 = repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[0],
      questionIndex: 0,
      idempotencyKey: idem1,
      userAnswerPayload: { selectedOption: 'option_a' },
      evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
    });

    const res1 = await p1;
    expect(res1.currentQuestionIndex).toBe(1);

    // Second request with mismatching index should fail closed
    await expect(
      repo.recordAttemptAtomic({
        uid: testUid,
        sessionId: testSessionId,
        questionId: curriculum10[0],
        questionIndex: 0, // stale index
        userAnswerPayload: { selectedOption: 'option_a' },
        evaluation: { is_correct: true, awarded_xp: 10, feedback: 'Correct' },
      })
    ).rejects.toThrow(ConflictError);
  });

  // TEST 8 — XP AND HISTORY: Follow-Up completion does not award XP or increment unique Primary completion ledger
  it('TEST 8: Follow-Up completion does not award XP or increment unique Primary completed count', async () => {
    const initialUser = store.users.get(`users/${testUid}`);
    const initialXp = initialUser.totalXp;
    const initialCompleted = initialUser.completedQuestionsCount;

    // Fail Q1
    await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: curriculum10[0],
      questionIndex: 0,
      userAnswerPayload: { selectedOption: 'option_b' },
      evaluation: { is_correct: false, awarded_xp: 0, feedback: 'Incorrect' },
    });

    // Complete Follow-Up
    const fuResult = await repo.recordAttemptAtomic({
      uid: testUid,
      sessionId: testSessionId,
      questionId: 'MG-AIA-01-PR',
      questionIndex: 1,
      branchState: 'FOLLOW_UP',
      userAnswerPayload: { selectedOption: 'option_a' },
      evaluation: { is_correct: true, awarded_xp: 0, feedback: 'Correct' },
    });

    expect(fuResult.xpAwarded).toBe(0);

    const userAfter = store.users.get(`users/${testUid}`);
    expect(userAfter.totalXp).toBe(initialXp);
    expect(userAfter.completedQuestionsCount).toBe(initialCompleted);
    expect(userAfter.lifetimeCompletedQuestionIds).not.toContain('MG-AIA-01-PR');
  });

  // TEST 15 — DAILY RESET: 09:00 IST boundary
  it('TEST 15: 08:59:59 IST belongs to previous cycle, 09:00:00 IST belongs to new cycle', () => {
    const beforeBoundary = new Date('2026-10-19T08:59:59+05:30');
    const atBoundary = new Date('2026-10-19T09:00:00+05:30');
    const afterBoundary = new Date('2026-10-19T09:00:01+05:30');

    expect(getDailyCycleDate(beforeBoundary)).toBe('2026-10-18');
    expect(getDailyCycleDate(atBoundary)).toBe('2026-10-19');
    expect(getDailyCycleDate(afterBoundary)).toBe('2026-10-19');
  });

  // TEST 16 — PREVIOUS-CYCLE ISOLATION: Unfinished session from previous cycle is not adopted
  it('TEST 16: An unfinished session from Saturday is not adopted on Monday after 09:00 IST', async () => {
    // Populate an active session for 2026-10-17 (Saturday)
    store.setSession('session_saturday', testUid, {
      sessionId: 'session_saturday',
      uid: testUid,
      userId: testUid,
      localDate: '2026-10-17',
      status: 'IN_PROGRESS',
      questionsCompleted: false,
      currentQuestionIndex: 7,
      questionIds: [...curriculum10],
      totalXpEarned: 70,
      correctCount: 7,
    });

    // Query for Monday's cycle (2026-10-19)
    const active = await repo.getActiveDailySession(testUid, '2026-10-19');
    // Must NOT adopt Saturday's session!
    expect(active).toBeNull();
  });

  describe('Streak Calculation and 09:00 IST Cycle Regression Tests', () => {
    const streakUid = 'user_streak_regression_001';

    const createCompletedSession = (sessionId: string, dateStr: string) => {
      store.setSession(sessionId, streakUid, {
        sessionId,
        uid: streakUid,
        userId: streakUid,
        localDate: dateStr,
        status: 'QUESTIONS_COMPLETED',
        questionsCompleted: true,
        currentQuestionIndex: 10,
        questionIds: [...curriculum10],
        totalXpEarned: 100,
        correctCount: 10,
      });
    };

    it('STREAK-01: Consecutive learning cycles increment streak by one', async () => {
      store.setUser(streakUid, {
        uid: streakUid,
        totalXp: 200,
        completedQuestionsCount: 20,
        lastActiveDate: '2026-10-18',
        learningState: {
          lastActiveDate: '2026-10-18',
          currentStreak: 3,
          longestStreak: 5,
          completedSessionsCount: 3,
          totalXp: 200,
          completedQuestionsCount: 20,
          totalCorrectAnswersCount: 18,
        },
      });

      const sessionId = 'session_cycle_2026-10-19';
      createCompletedSession(sessionId, '2026-10-19');

      const result = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId,
        todayDateStr: '2026-10-19',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.updatedLearningState?.currentStreak).toBe(4);
      expect(result.updatedLearningState?.longestStreak).toBe(5);
      expect(result.updatedLearningState?.completedSessionsCount).toBe(4);
      expect(result.updatedLearningState?.lastActiveDate).toBe('2026-10-19');

      // Assert persisted user state in store
      const persistedUser = store.users.get(`users/${streakUid}`);
      expect(persistedUser.learningState.currentStreak).toBe(4);
      expect(persistedUser.learningState.lastActiveDate).toBe('2026-10-19');
      expect(persistedUser.learningState.completedSessionsCount).toBe(4);
    });

    it('STREAK-02: Multiple completions within the same learning cycle do not increment streak again', async () => {
      store.setUser(streakUid, {
        uid: streakUid,
        totalXp: 300,
        completedQuestionsCount: 30,
        lastActiveDate: '2026-10-19',
        learningState: {
          lastActiveDate: '2026-10-19',
          currentStreak: 4,
          longestStreak: 5,
          completedSessionsCount: 4,
          totalXp: 300,
          completedQuestionsCount: 30,
          totalCorrectAnswersCount: 28,
        },
      });

      const secondSessionId = 'session_cycle_2026-10-19_extra';
      createCompletedSession(secondSessionId, '2026-10-19');

      const result = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: secondSessionId,
        todayDateStr: '2026-10-19',
      });

      expect(result.success).toBe(true);
      expect(result.alreadyFinalized).toBe(false);
      // Streak must NOT increment again on same cycle
      expect(result.updatedLearningState?.currentStreak).toBe(4);
      expect(result.updatedLearningState?.completedSessionsCount).toBe(5);
      expect(result.updatedLearningState?.lastActiveDate).toBe('2026-10-19');

      const persistedUser = store.users.get(`users/${streakUid}`);
      expect(persistedUser.learningState.currentStreak).toBe(4);
      expect(persistedUser.learningState.completedSessionsCount).toBe(5);
    });

    it('STREAK-03: Two-cycle inactivity gap resets streak to 1', async () => {
      store.setUser(streakUid, {
        uid: streakUid,
        totalXp: 400,
        completedQuestionsCount: 40,
        lastActiveDate: '2026-10-17', // Missed 2026-10-18 (2 cycles elapsed to 2026-10-19)
        learningState: {
          lastActiveDate: '2026-10-17',
          currentStreak: 5,
          longestStreak: 5,
          completedSessionsCount: 5,
          totalXp: 400,
          completedQuestionsCount: 40,
          totalCorrectAnswersCount: 38,
        },
      });

      const sessionId = 'session_after_2_days';
      createCompletedSession(sessionId, '2026-10-19');

      const result = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId,
        todayDateStr: '2026-10-19',
      });

      expect(result.success).toBe(true);
      expect(result.updatedLearningState?.currentStreak).toBe(1);
      expect(result.updatedLearningState?.longestStreak).toBe(5);
      expect(result.updatedLearningState?.lastActiveDate).toBe('2026-10-19');

      const persistedUser = store.users.get(`users/${streakUid}`);
      expect(persistedUser.learningState.currentStreak).toBe(1);
      expect(persistedUser.learningState.longestStreak).toBe(5);
    });

    it('STREAK-04: Seven-cycle inactivity gap resets streak to 1', async () => {
      store.setUser(streakUid, {
        uid: streakUid,
        totalXp: 500,
        completedQuestionsCount: 50,
        lastActiveDate: '2026-10-12', // 7 cycles gap to 2026-10-19
        learningState: {
          lastActiveDate: '2026-10-12',
          currentStreak: 8,
          longestStreak: 8,
          completedSessionsCount: 8,
          totalXp: 500,
          completedQuestionsCount: 50,
          totalCorrectAnswersCount: 48,
        },
      });

      const sessionId = 'session_after_7_days';
      createCompletedSession(sessionId, '2026-10-19');

      const result = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId,
        todayDateStr: '2026-10-19',
      });

      expect(result.success).toBe(true);
      expect(result.updatedLearningState?.currentStreak).toBe(1);
      expect(result.updatedLearningState?.longestStreak).toBe(8);
      expect(result.updatedLearningState?.lastActiveDate).toBe('2026-10-19');

      const persistedUser = store.users.get(`users/${streakUid}`);
      expect(persistedUser.learningState.currentStreak).toBe(1);
    });

    it('STREAK-05: Session completed around the 09:00 IST boundary respects learning-cycle date', async () => {
      // 08:59:59 IST belongs to 2026-10-18 cycle
      const timeBeforeBoundary = new Date('2026-10-19T08:59:59+05:30');
      const cycleBefore = getDailyCycleDate(timeBeforeBoundary);
      expect(cycleBefore).toBe('2026-10-18');

      // User active on 2026-10-17 with streak 2
      store.setUser(streakUid, {
        uid: streakUid,
        lastActiveDate: '2026-10-17',
        learningState: {
          lastActiveDate: '2026-10-17',
          currentStreak: 2,
          longestStreak: 2,
          completedSessionsCount: 2,
        },
      });

      // Session finalized at 08:59:59 IST (cycle 2026-10-18)
      const sessionBefore = 'session_before_boundary';
      createCompletedSession(sessionBefore, cycleBefore);

      const resBefore = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: sessionBefore,
        todayDateStr: cycleBefore,
      });

      expect(resBefore.updatedLearningState?.currentStreak).toBe(3);
      expect(resBefore.updatedLearningState?.lastActiveDate).toBe('2026-10-18');

      // Now at 09:00:01 IST belongs to 2026-10-19 cycle
      const timeAfterBoundary = new Date('2026-10-19T09:00:01+05:30');
      const cycleAfter = getDailyCycleDate(timeAfterBoundary);
      expect(cycleAfter).toBe('2026-10-19');

      const sessionAfter = 'session_after_boundary';
      createCompletedSession(sessionAfter, cycleAfter);

      const resAfter = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: sessionAfter,
        todayDateStr: cycleAfter,
      });

      // Consecutive with 2026-10-18 completed at 08:59:59 IST!
      expect(resAfter.updatedLearningState?.currentStreak).toBe(4);
      expect(resAfter.updatedLearningState?.lastActiveDate).toBe('2026-10-19');

      const persistedUser = store.users.get(`users/${streakUid}`);
      expect(persistedUser.learningState.currentStreak).toBe(4);
      expect(persistedUser.learningState.lastActiveDate).toBe('2026-10-19');
    });

    it('STREAK-06: Missing or invalid lastActiveDate initializes streak to 1 safely', async () => {
      // Subcase A: missing lastActiveDate
      store.setUser(streakUid, {
        uid: streakUid,
        totalXp: 100,
        completedQuestionsCount: 10,
        learningState: {
          totalXp: 100,
          completedQuestionsCount: 10,
        },
      });

      const sessionMissing = 'session_missing_date';
      createCompletedSession(sessionMissing, '2026-10-19');

      const resMissing = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: sessionMissing,
        todayDateStr: '2026-10-19',
      });

      expect(resMissing.updatedLearningState?.currentStreak).toBe(1);
      expect(resMissing.updatedLearningState?.lastActiveDate).toBe('2026-10-19');

      // Subcase B: invalid lastActiveDate string
      store.setUser(streakUid, {
        uid: streakUid,
        lastActiveDate: 'invalid-date-not-an-iso',
        learningState: {
          lastActiveDate: 'invalid-date-not-an-iso',
          currentStreak: 9,
        },
      });

      const sessionInvalid = 'session_invalid_date';
      createCompletedSession(sessionInvalid, '2026-10-19');

      const resInvalid = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: sessionInvalid,
        todayDateStr: '2026-10-19',
      });

      expect(resInvalid.updatedLearningState?.currentStreak).toBe(1);
      expect(resInvalid.updatedLearningState?.lastActiveDate).toBe('2026-10-19');
    });

    it('STREAK-07: Repeated finalization of the same session is idempotent and preserves streak and counters', async () => {
      store.setUser(streakUid, {
        uid: streakUid,
        lastActiveDate: '2026-10-18',
        learningState: {
          lastActiveDate: '2026-10-18',
          currentStreak: 1,
          longestStreak: 2,
          completedSessionsCount: 1,
          totalXp: 100,
          completedQuestionsCount: 10,
          totalCorrectAnswersCount: 8,
        },
      });

      const repeatSessionId = 'session_repeat_test';
      createCompletedSession(repeatSessionId, '2026-10-19');

      // 1st finalization
      const firstFinalize = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: repeatSessionId,
        todayDateStr: '2026-10-19',
      });

      expect(firstFinalize.success).toBe(true);
      expect(firstFinalize.alreadyFinalized).toBe(false);
      expect(firstFinalize.updatedLearningState?.currentStreak).toBe(2);
      expect(firstFinalize.updatedLearningState?.completedSessionsCount).toBe(2);

      // 2nd finalization (idempotent replay)
      const secondFinalize = await repo.finalizeSessionAtomic({
        uid: streakUid,
        sessionId: repeatSessionId,
        todayDateStr: '2026-10-19',
      });

      expect(secondFinalize.success).toBe(false);
      expect(secondFinalize.alreadyFinalized).toBe(true);

      const persistedUser = store.users.get(`users/${streakUid}`);
      expect(persistedUser.learningState.currentStreak).toBe(2);
      expect(persistedUser.learningState.completedSessionsCount).toBe(2);
    });
  });
});
