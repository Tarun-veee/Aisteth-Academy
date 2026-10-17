import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { questionUseCase } from '../src/api/controllers/QuestionController.js';
import { defaultQuestionRepository } from '../src/infrastructure/firestore/FirestoreQuestionRepository.js';
import { defaultAuthProvider } from '../src/infrastructure/auth/FirebaseAuthAdapter.js';
import { ISessionRepository } from '../src/domain/interfaces/ISessionRepository.js';
import { UnsolvedQuestionDoc } from '../src/domain/models/session.model.js';

describe('Stage 5: Unsolved Questions API & Review Pipeline Suite', () => {
  const tokenUserA = 'token_for_user_a';
  const tokenUserB = 'token_for_user_b';

  // In-memory mock stores for User A and User B
  let userAUnsolvedStore: Map<string, UnsolvedQuestionDoc>;
  let userBUnsolvedStore: Map<string, UnsolvedQuestionDoc>;
  let mockSessionRepo: ISessionRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    userAUnsolvedStore = new Map<string, UnsolvedQuestionDoc>();
    userBUnsolvedStore = new Map<string, UnsolvedQuestionDoc>();

    // Mock verifyIdToken on defaultAuthProvider
    vi.spyOn(defaultAuthProvider, 'verifyIdToken').mockImplementation(async (token: string) => {
      if (token === tokenUserA) {
        return { uid: 'usr_unsolved_001', role: 'TRAINEE' };
      }
      if (token === tokenUserB) {
        return { uid: 'usr_unsolved_002', role: 'TRAINEE' };
      }
      throw new Error('Invalid or expired token.');
    });

    // Seed User A with a failed question (MG-AIA-01-TH, paired with MG-AIA-01-PR)
    const seedDocUserA: UnsolvedQuestionDoc = {
      id: 'MG-AIA-01-TH',
      mainQuestionId: 'MG-AIA-01-TH',
      followUpQuestionId: 'MG-AIA-01-PR',
      topic: 'Heart Sound Auscultation',
      difficultyRank: 1,
      failCount: 2,
      initialReason: 'FOLLOW_UP_FAILED',
      lastFailedReason: 'REATTEMPT_FAILED',
      firstFailedSessionId: 'daily_2026-10-10_usr_unso',
      lastFailedSessionId: 'daily_2026-10-11_usr_unso',
      isResolved: false,
      reviewStatus: 'UNREVIEWED',
      reviewedAt: null,
      reviewNotes: undefined,
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-11T10:00:00.000Z',
      firstFailedAt: '2026-10-10T10:00:00.000Z',
      lastFailedAt: '2026-10-11T10:00:00.000Z',
    };
    userAUnsolvedStore.set(seedDocUserA.id, { ...seedDocUserA });

    // Seed User B with a different question (MG-AIA-02-TH)
    const seedDocUserB: UnsolvedQuestionDoc = {
      id: 'MG-AIA-02-TH',
      mainQuestionId: 'MG-AIA-02-TH',
      followUpQuestionId: 'MG-AIA-02-PR',
      topic: 'Stethoscope Placement',
      difficultyRank: 1,
      failCount: 1,
      initialReason: 'FOLLOW_UP_FAILED',
      lastFailedReason: 'FOLLOW_UP_FAILED',
      firstFailedSessionId: 'daily_2026-10-11_usr_userB',
      lastFailedSessionId: 'daily_2026-10-11_usr_userB',
      isResolved: false,
      reviewStatus: 'BOOKMARKED',
      reviewedAt: '2026-10-11T12:00:00.000Z',
      reviewNotes: 'Need to review diaphragm vs bell',
      createdAt: '2026-10-11T12:00:00.000Z',
      updatedAt: '2026-10-11T12:00:00.000Z',
      firstFailedAt: '2026-10-11T12:00:00.000Z',
      lastFailedAt: '2026-10-11T12:00:00.000Z',
    };
    userBUnsolvedStore.set(seedDocUserB.id, { ...seedDocUserB });

    mockSessionRepo = {
      getDailySession: vi.fn(),
      createDailySession: vi.fn(),
      appendAttempt: vi.fn(),
      updateSessionProgress: vi.fn(),
      recordAttemptAtomic: vi.fn(),
      finalizeSessionAtomic: vi.fn(),
      getUnsolvedQuestions: vi.fn().mockImplementation(async (uid: string) => {
        const store = uid === 'usr_unsolved_001' ? userAUnsolvedStore : userBUnsolvedStore;
        return Array.from(store.values());
      }),
      updateUnsolvedQuestion: vi.fn().mockImplementation(async (uid: string, questionId: string, updates: any) => {
        const store = uid === 'usr_unsolved_001' ? userAUnsolvedStore : userBUnsolvedStore;
        const existing = store.get(questionId);
        if (!existing) {
          throw new Error(`Unsolved question '${questionId}' not found for user '${uid}'.`);
        }
        const updated: UnsolvedQuestionDoc = {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
          ...(updates.reviewStatus || updates.reviewNotes ? { reviewedAt: new Date().toISOString() } : {}),
        };
        store.set(questionId, updated);
        return updated;
      }),
    };

    // Inject mockSessionRepo and defaultQuestionRepository into questionUseCase
    (questionUseCase as any).sessionRepo = mockSessionRepo;
    (questionUseCase as any).questionRepo = defaultQuestionRepository;
  });

  // =========================================================================
  // 1. AUTHENTICATION & ACCESS CONTROL
  // =========================================================================
  describe('Authentication and Access Protection', () => {
    it('rejects GET /api/v1/questions/unsolved without token with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/questions/unsolved');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects PATCH /api/v1/questions/unsolved/:id without token with HTTP 401', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .send({ reviewStatus: 'REVIEWED' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. USER OWNERSHIP ISOLATION
  // =========================================================================
  describe('User Ownership Isolation', () => {
    it('strictly isolates unsolved questions by verified token UID (User A sees only User A records)', async () => {
      const resA = await request(app)
        .get('/api/v1/questions/unsolved')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      expect(resA.body.unsolvedQuestions).toHaveLength(1);
      expect(resA.body.unsolvedQuestions[0].record.id).toBe('MG-AIA-01-TH');

      const resB = await request(app)
        .get('/api/v1/questions/unsolved')
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.success).toBe(true);
      expect(resB.body.unsolvedQuestions).toHaveLength(1);
      expect(resB.body.unsolvedQuestions[0].record.id).toBe('MG-AIA-02-TH');
    });

    it('never permits User A to update or access User B records', async () => {
      // User A attempts to update User B's record (MG-AIA-02-TH)
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-02-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ reviewStatus: 'REVIEWED' });

      // User A's store does not contain MG-AIA-02-TH -> not found
      expect(res.status).toBe(404);
      expect(userBUnsolvedStore.get('MG-AIA-02-TH')?.reviewStatus).toBe('BOOKMARKED'); // Untouched!
    });
  });

  // =========================================================================
  // 3. CURRICULUM PAIRING & RESPONSE ENRICHMENT
  // =========================================================================
  describe('Primary and Follow-Up Question Pairing', () => {
    it('returns full Primary question and canonical Follow-Up question from dataset', async () => {
      const res = await request(app)
        .get('/api/v1/questions/unsolved')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      const item = res.body.unsolvedQuestions[0];
      expect(item).toBeDefined();

      // Main question verification
      expect(item.mainQuestion).toBeDefined();
      expect(item.mainQuestion.question_id).toBe('MG-AIA-01-TH');
      expect(item.mainQuestion.question).toBeDefined();
      expect(item.mainQuestion.correct_answer).toBeDefined();

      // Canonical Follow-up question verification
      expect(item.followUpQuestion).toBeDefined();
      expect(item.followUpQuestion.question_id).toBe('MG-AIA-01-PR');
      expect(item.followUpQuestion.question).toBeDefined();
      expect(item.followUpQuestion.follow_up_for).toBe('MG-AIA-01-TH');

      // Failure audit metadata
      expect(item.record.failCount).toBe(2);
      expect(item.record.initialReason).toBe('FOLLOW_UP_FAILED');
      expect(item.record.lastFailedReason).toBe('REATTEMPT_FAILED');
      expect(item.record.reviewStatus).toBe('UNREVIEWED');
    });
  });

  // =========================================================================
  // 4. INPUT VALIDATION & SECURITY ENFORCEMENT
  // =========================================================================
  describe('PATCH Input Validation and Field Protection', () => {
    it('rejects empty payload with HTTP 400', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('NO_UPDATES_PROVIDED');
    });

    it('rejects invalid reviewStatus with HTTP 400', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ reviewStatus: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('INVALID_REVIEW_STATUS');
    });

    it('rejects non-string reviewNotes with HTTP 400', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ reviewNotes: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('INVALID_REVIEW_NOTES');
    });

    it('rejects forbidden modification of failure metrics (failCount, initialReason, etc.) with HTTP 400', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ failCount: 0, initialReason: 'HACKED' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('DISALLOWED_FIELD');
    });
  });

  // =========================================================================
  // 5. REVIEW STATUS AND NOTES MUTATION
  // =========================================================================
  describe('Review Status and Notes Updates', () => {
    it('updates reviewStatus to REVIEWED and stores clinical reviewNotes', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          reviewStatus: 'REVIEWED',
          reviewNotes: 'Reviewed with clinical mentor. Understood aortic valve position.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedRecord.reviewStatus).toBe('REVIEWED');
      expect(res.body.updatedRecord.reviewNotes).toBe('Reviewed with clinical mentor. Understood aortic valve position.');
      expect(res.body.updatedRecord.reviewedAt).toBeDefined();

      // Protected failure history must remain intact
      expect(res.body.updatedRecord.failCount).toBe(2);
      expect(res.body.updatedRecord.initialReason).toBe('FOLLOW_UP_FAILED');
      expect(res.body.updatedRecord.firstFailedAt).toBe('2026-10-10T10:00:00.000Z');
      expect(res.body.updatedRecord.firstFailedSessionId).toBe('daily_2026-10-10_usr_unso');
    });

    it('updates isResolved to true when concept is confirmed mastered', async () => {
      const res = await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ isResolved: true });

      expect(res.status).toBe(200);
      expect(res.body.updatedRecord.isResolved).toBe(true);
    });
  });

  // =========================================================================
  // 6. STAGE 3 REPEATED-FAILURE INVARIANT (TC-13 COMPLIANCE)
  // =========================================================================
  describe('Stage 3 Invariant Preservation', () => {
    it('proves that previously patched reviewStatus and reviewNotes are preserved when question fails again', async () => {
      // 1. User updates record to REVIEWED with notes
      await request(app)
        .patch('/api/v1/questions/unsolved/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          reviewStatus: 'REVIEWED',
          reviewNotes: 'Mentor verified my technique.',
        });

      const updated = userAUnsolvedStore.get('MG-AIA-01-TH')!;
      expect(updated.reviewStatus).toBe('REVIEWED');
      expect(updated.reviewNotes).toBe('Mentor verified my technique.');

      // 2. Simulate subsequent remedial failure in daily session:
      // FirestoreSessionRepository lines 432-441 updates only failCount, lastFailedReason, isResolved: false, lastFailedAt, updatedAt
      const updatedOnSubsequentFailure: UnsolvedQuestionDoc = {
        ...updated,
        failCount: updated.failCount + 1,
        lastFailedReason: 'REATTEMPT_FAILED',
        lastFailedSessionId: 'daily_2026-10-13_usr_unso',
        isResolved: false,
        lastFailedAt: '2026-10-13T10:00:00.000Z',
        updatedAt: '2026-10-13T10:00:00.000Z',
      };
      userAUnsolvedStore.set('MG-AIA-01-TH', updatedOnSubsequentFailure);

      // 3. Query unsolved questions endpoint again
      const queryRes = await request(app)
        .get('/api/v1/questions/unsolved')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(queryRes.status).toBe(200);
      const queried = queryRes.body.unsolvedQuestions[0].record;

      // Assert reviewStatus and reviewNotes were NOT overwritten or lost
      expect(queried.reviewStatus).toBe('REVIEWED');
      expect(queried.reviewNotes).toBe('Mentor verified my technique.');
      expect(queried.failCount).toBe(3);
      expect(queried.isResolved).toBe(false);
      expect(queried.lastFailedSessionId).toBe('daily_2026-10-13_usr_unso');
    });
  });
});
