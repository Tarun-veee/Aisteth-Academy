import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { questionUseCase } from '../src/api/controllers/QuestionController.js';
import { sessionUseCase } from '../src/api/controllers/SessionController.js';
import { defaultAuthProvider } from '../src/infrastructure/auth/FirebaseAuthAdapter.js';
import { toSafeQuestionDTO, DataIntegrityError } from '../src/application/dtos/question.dto.js';
import { Question, MCQQuestion } from '../src/domain/models/question.model.js';
import { DailySessionDoc, UnsolvedQuestionDoc } from '../src/domain/models/session.model.js';
import { IQuestionRepository } from '../src/domain/interfaces/IQuestionRepository.js';
import { ISessionRepository } from '../src/domain/interfaces/ISessionRepository.js';
import { CANONICAL_31_TOPIC_SEQUENCE, getResolvedCalendarDate } from '../src/domain/rules/sessionSelection.js';

describe('Phase 1: API Security & DTO Sanitization Boundary Suite', () => {
  // =========================================================================
  // SECTION 1: PURE MAPPER UNIT TESTS (MAP-01 to MAP-10)
  // =========================================================================
  describe('Pure Mapper Unit Tests (MAP-01 to MAP-10)', () => {
    it('MAP-01: Valid Primary question maps to SafeQuestionDTO preserving text verbatim and removing sensitive fields', () => {
      const validPrimary: MCQQuestion = {
        question_id: 'MG-AIA-01-TH',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Identify the characteristic heart sound associated with mitral stenosis.',
        option_a: 'Opening snap followed by low-pitched diastolic rumble',
        option_b: 'Harsh systolic ejection murmur radiating to carotids',
        option_c: 'Holosystolic blowing murmur radiating to axilla',
        option_d: 'High-pitched early diastolic decrescendo murmur',
        correct_answer: 'option_a',
        explanation: 'Mitral stenosis classically produces an opening snap and diastolic rumble.',
        action: 'Prescribe echocardiography and refer to cardiology.',
        learning_objective: 'Understand auscultation hallmarks of stenotic mitral valve.',
        medGemma_tag: 'Valvular Disease'
      };

      const safeDto = toSafeQuestionDTO(validPrimary);

      // Safe fields present
      expect(safeDto.questionId).toBe('MG-AIA-01-TH');
      expect(safeDto.topic).toBe('ASHA role');
      expect(safeDto.category).toBe('HEART_RECORDING');
      expect(safeDto.difficulty).toBe('BEGINNER');
      expect(safeDto.questionType).toBe('Primary');
      expect(safeDto.followUpFor).toBeNull();
      expect(safeDto.question).toBe('Identify the characteristic heart sound associated with mitral stenosis.');
      expect(safeDto.options).toEqual({
        option_a: 'Opening snap followed by low-pitched diastolic rumble',
        option_b: 'Harsh systolic ejection murmur radiating to carotids',
        option_c: 'Holosystolic blowing murmur radiating to axilla',
        option_d: 'High-pitched early diastolic decrescendo murmur'
      });
      expect(safeDto.medGemmaTag).toBe('Valvular Disease');

      // Protected clinical & answer fields strictly stripped
      expect((safeDto as any).correct_answer).toBeUndefined();
      expect((safeDto as any).explanation).toBeUndefined();
      expect((safeDto as any).action).toBeUndefined();
      expect((safeDto as any).learning_objective).toBeUndefined();
      expect(safeDto.type).toBe('MCQ');
    });

    it('MAP-02: Valid Follow-Up question maps to SafeQuestionDTO preserving parent pointer', () => {
      const validFollowUp: MCQQuestion = {
        question_id: 'MG-AIA-01-PR',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'INTERMEDIATE',
        type: 'MCQ',
        question_type: 'Follow-Up',
        follow_up_for: 'MG-AIA-01-TH',
        question: 'What physical maneuver best accentuates this diastolic rumble?',
        option_a: 'Left lateral decubitus position in expiration',
        option_b: 'Standing upright in inspiration',
        option_c: 'Valsalva phase II strain',
        option_d: 'Rapid squatting release',
        correct_answer: 'option_a',
        explanation: 'Left lateral decubitus position brings the mitral apex closer to the chest wall.',
        action: 'Position patient on left side with stethoscope bell at the apex.',
        learning_objective: 'Apply dynamic maneuvers for mitral murmur enhancement.',
        medGemma_tag: 'Dynamic Auscultation'
      };

      const safeDto = toSafeQuestionDTO(validFollowUp);

      expect(safeDto.questionId).toBe('MG-AIA-01-PR');
      expect(safeDto.questionType).toBe('Follow-Up');
      expect(safeDto.followUpFor).toBe('MG-AIA-01-TH');
      expect((safeDto as any).correct_answer).toBeUndefined();
      expect((safeDto as any).explanation).toBeUndefined();
      expect((safeDto as any).action).toBeUndefined();
      expect((safeDto as any).learning_objective).toBeUndefined();
      expect(safeDto.type).toBe('MCQ');
    });

    it('MAP-03: Malformed question ID throws DataIntegrityError', () => {
      const malformedId: any = {
        question_id: 'INVALID_ID_FORMAT',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(malformedId)).toThrow(DataIntegrityError);
    });

    it('MAP-04: Lineage Type Mismatch (ID ends with -TH but question_type is Follow-Up) throws DataIntegrityError', () => {
      const mismatchQuestion: any = {
        question_id: 'MG-AIA-01-TH',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Follow-Up',
        follow_up_for: 'MG-AIA-02-TH',
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(mismatchQuestion)).toThrow(DataIntegrityError);
    });

    it('MAP-05: Lineage Type Mismatch (ID ends with -PR but question_type is Primary) throws DataIntegrityError', () => {
      const mismatchQuestion: any = {
        question_id: 'MG-AIA-01-PR',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(mismatchQuestion)).toThrow(DataIntegrityError);
    });

    it('MAP-06: Primary question with non-null follow_up_for throws DataIntegrityError', () => {
      const invalidPrimary: any = {
        question_id: 'MG-AIA-01-TH',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: 'MG-AIA-02-TH',
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(invalidPrimary)).toThrow(DataIntegrityError);
    });

    it('MAP-07: Follow-Up question with empty string follow_up_for throws DataIntegrityError', () => {
      const invalidFollowUp: any = {
        question_id: 'MG-AIA-01-PR',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Follow-Up',
        follow_up_for: '',
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(invalidFollowUp)).toThrow(DataIntegrityError);
    });

    it('MAP-08: MCQ question missing option_c throws DataIntegrityError', () => {
      const incompleteOptions: any = {
        question_id: 'MG-AIA-01-TH',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Sample question stem?',
        option_a: 'A',
        option_b: 'B',
        option_c: '',
        option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(incompleteOptions)).toThrow(DataIntegrityError);
    });

    it('MAP-09: Question with unknown topic throws DataIntegrityError', () => {
      const unknownTopic: any = {
        question_id: 'MG-AIA-01-TH',
        topic: 'Cardiology Unknown',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(unknownTopic)).toThrow(DataIntegrityError);
    });

    it('MAP-10: Question with invalid category throws DataIntegrityError', () => {
      const invalidCategory: any = {
        question_id: 'MG-AIA-01-TH',
        topic: 'ASHA role',
        category: 'SURGERY',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Sample question stem?',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a'
      };

      expect(() => toSafeQuestionDTO(invalidCategory)).toThrow(DataIntegrityError);
    });
  });

  // =========================================================================
  // SECTION 2: SUPERTEST HTTP CONTRACT TESTS (HTTP-01 to HTTP-14)
  // =========================================================================
  describe('Supertest HTTP Contract Tests (HTTP-01 to HTTP-14)', () => {
    const tokenUserA = 'token_user_a_valid';
    const tokenUserB = 'token_user_b_valid';

    let userAUnsolvedStore: Map<string, UnsolvedQuestionDoc>;
    let userBUnsolvedStore: Map<string, UnsolvedQuestionDoc>;
    let questionDatabase: Map<string, Question>;
    let mockSessionRepo: ISessionRepository;
    let mockQuestionRepo: IQuestionRepository;

    beforeEach(() => {
      vi.clearAllMocks();

      userAUnsolvedStore = new Map();
      userBUnsolvedStore = new Map();
      questionDatabase = new Map();

      // Seed 10 valid primary questions for the daily session
      for (let i = 1; i <= 10; i++) {
        const idNum = i < 10 ? `0${i}` : `${i}`;
        const qId = `MG-AIA-${idNum}-TH`;
        const q: MCQQuestion = {
          question_id: qId,
          topic: 'ASHA role',
          category: 'HEART_RECORDING',
          difficulty: 'BEGINNER',
          type: 'MCQ',
          question_type: 'Primary',
          follow_up_for: null,
          question: `Clinical diagnosis scenario stem ${i}.`,
          option_a: `Option A for question ${i}`,
          option_b: `Option B for question ${i}`,
          option_c: `Option C for question ${i}`,
          option_d: `Option D for question ${i}`,
          correct_answer: 'option_a',
          explanation: `Clinical explanation for question ${i}.`,
          action: `Clinical management action for question ${i}.`,
          learning_objective: `Learning objective for question ${i}.`,
          medGemma_tag: 'Auscultation'
        };
        questionDatabase.set(qId, q);
      }

      // Seed valid follow-up linked to MG-AIA-01-TH
      const followUp1: MCQQuestion = {
        question_id: 'MG-AIA-01-PR',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'INTERMEDIATE',
        type: 'MCQ',
        question_type: 'Follow-Up',
        follow_up_for: 'MG-AIA-01-TH',
        question: 'Follow-up clinical verification step.',
        option_a: 'Option A follow-up',
        option_b: 'Option B follow-up',
        option_c: 'Option C follow-up',
        option_d: 'Option D follow-up',
        correct_answer: 'option_b',
        explanation: 'Follow-up clinical explanation.',
        action: 'Perform follow-up maneuver.',
        learning_objective: 'Master follow-up verification.',
        medGemma_tag: 'Auscultation'
      };
      questionDatabase.set('MG-AIA-01-PR', followUp1);

      // Seed topic mismatch pair for HTTP-12
      const mismatchParent: MCQQuestion = {
        question_id: 'MG-MISMATCH-01-TH',
        topic: 'ASHA role',
        category: 'HEART_RECORDING',
        difficulty: 'BEGINNER',
        type: 'MCQ',
        question_type: 'Primary',
        follow_up_for: null,
        question: 'Parent stem for topic mismatch test.',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_a',
        explanation: 'Parent explanation.',
        action: 'Parent action.',
      };
      const mismatchChild: MCQQuestion = {
        question_id: 'MG-MISMATCH-01-PR',
        topic: 'AiSteth', // Different canonical topic
        category: 'ANATOMICAL_PLACEMENT',
        difficulty: 'INTERMEDIATE',
        type: 'MCQ',
        question_type: 'Follow-Up',
        follow_up_for: 'MG-MISMATCH-01-TH',
        question: 'Follow-up stem with topic mismatch.',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D',
        correct_answer: 'option_b',
        explanation: 'Child explanation.',
        action: 'Child action.',
      };
      questionDatabase.set('MG-MISMATCH-01-TH', mismatchParent);
      questionDatabase.set('MG-MISMATCH-01-PR', mismatchChild);

      // Seed User A failed question (MG-AIA-01-TH)
      userAUnsolvedStore.set('MG-AIA-01-TH', {
        id: 'MG-AIA-01-TH',
        mainQuestionId: 'MG-AIA-01-TH',
        followUpQuestionId: 'MG-AIA-01-PR',
        topic: 'ASHA role',
        difficultyRank: 1,
        failCount: 1,
        initialReason: 'FOLLOW_UP_FAILED',
        lastFailedReason: 'FOLLOW_UP_FAILED',
        firstFailedSessionId: 'daily_2026-10-14_usr_trai',
        lastFailedSessionId: 'daily_2026-10-14_usr_trai',
        isResolved: false,
        reviewStatus: 'UNREVIEWED',
        reviewedAt: null,
        createdAt: '2026-10-14T10:00:00.000Z',
        updatedAt: '2026-10-14T10:00:00.000Z',
        firstFailedAt: '2026-10-14T10:00:00.000Z',
        lastFailedAt: '2026-10-14T10:00:00.000Z',
      });

      // Seed User B failed question (MG-AIA-02-TH)
      userBUnsolvedStore.set('MG-AIA-02-TH', {
        id: 'MG-AIA-02-TH',
        mainQuestionId: 'MG-AIA-02-TH',
        followUpQuestionId: null,
        topic: 'ASHA role',
        difficultyRank: 1,
        failCount: 2,
        initialReason: 'MAIN_FAILED',
        lastFailedReason: 'MAIN_FAILED',
        firstFailedSessionId: 'daily_2026-10-14_usr_userB',
        lastFailedSessionId: 'daily_2026-10-14_usr_userB',
        isResolved: false,
        reviewStatus: 'BOOKMARKED',
        reviewedAt: null,
        createdAt: '2026-10-14T11:00:00.000Z',
        updatedAt: '2026-10-14T11:00:00.000Z',
        firstFailedAt: '2026-10-14T11:00:00.000Z',
        lastFailedAt: '2026-10-14T11:00:00.000Z',
      });

      // Mock auth provider
      vi.spyOn(defaultAuthProvider, 'verifyIdToken').mockImplementation(async (token: string) => {
        if (token === tokenUserA) {
          return { uid: 'usr_trainee_01', role: 'TRAINEE' };
        }
        if (token === tokenUserB) {
          return { uid: 'usr_trainee_02', role: 'TRAINEE' };
        }
        throw new Error('Invalid or expired token.');
      });

      // Mock question repository
      mockQuestionRepo = {
        getAllQuestions: vi.fn().mockImplementation(async () => Array.from(questionDatabase.values())),
        getQuestionById: vi.fn().mockImplementation(async (id: string) => questionDatabase.get(id) || null),
        getFollowUpQuestion: vi.fn().mockImplementation(async (mainQuestionId: string) => {
          if (mainQuestionId === 'MG-AIA-01-TH') return questionDatabase.get('MG-AIA-01-PR') || null;
          if (mainQuestionId === 'MG-MISMATCH-01-TH') return questionDatabase.get('MG-MISMATCH-01-PR') || null;
          return null;
        }),
        getSessionQuestions: vi.fn().mockImplementation(async () => {
          return Array.from(questionDatabase.values()).filter(q => q.question_type === 'Primary').slice(0, 10);
        }),
      } as any;

      // Mock session repository
      const todayDateStr = getResolvedCalendarDate();
      const canonicalSessionId = sessionUseCase.generateCanonicalSessionId('usr_trainee_01', todayDateStr);

      const dailySessionDoc: DailySessionDoc = {
        sessionId: canonicalSessionId,
        uid: 'usr_trainee_01',
        userId: 'usr_trainee_01',
        localDate: todayDateStr,
        contentReleaseId: 'rel_v1_0_0',
        status: 'IN_PROGRESS',
        questionIds: [
          'MG-AIA-01-TH', 'MG-AIA-02-TH', 'MG-AIA-03-TH', 'MG-AIA-04-TH', 'MG-AIA-05-TH',
          'MG-AIA-06-TH', 'MG-AIA-07-TH', 'MG-AIA-08-TH', 'MG-AIA-09-TH', 'MG-AIA-10-TH'
        ],
        selectedTopics: ['ASHA role'],
        currentQuestionIndex: 0,
        questionsCompleted: false,
        reviewViewed: false,
        totalXpEarned: 0,
        correctCount: 0,
        accuracy: 0,
        powerUpsUsed: {
          FIFTY_FIFTY: [],
          LEARN: []
        }
      };

      mockSessionRepo = {
        getDailySession: vi.fn().mockImplementation(async (uid: string, sessionId: string) => {
          if (uid === 'usr_trainee_01' && (sessionId === canonicalSessionId || sessionId === 'daily_2026-10-15_usr_trai' || sessionId.startsWith('daily_'))) {
            return {
              ...dailySessionDoc,
              sessionId,
              localDate: sessionId.startsWith('daily_') && sessionId.split('_')[1] ? sessionId.split('_')[1] : todayDateStr,
            };
          }
          return null;
        }),
        getActiveDailySession: vi.fn().mockResolvedValue(null),
        createDailySession: vi.fn().mockResolvedValue(undefined),
        updateSessionProgress: vi.fn().mockResolvedValue(undefined),
        updateUser: vi.fn().mockResolvedValue(undefined),
        getUser: vi.fn().mockResolvedValue({ topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE], lifetimeCompletedQuestionIds: [] }),
        recordAttemptAtomic: vi.fn().mockImplementation(async (params: any) => {
          return {
            attemptId: 'att_001',
            currentQuestionIndex: 1,
            branchState: 'MAIN',
            result: 'CORRECT',
            xpAwarded: 5,
            isSessionComplete: false,
            status: 'IN_PROGRESS',
            questionsCompleted: false,
            totalXpEarned: 5,
            correctCount: 1,
            activeFollowUpQuestionId: null,
          };
        }),
        finalizeSessionAtomic: vi.fn(),
        getUnsolvedQuestions: vi.fn().mockImplementation(async (uid: string) => {
          const store = uid === 'usr_trainee_01' ? userAUnsolvedStore : userBUnsolvedStore;
          return Array.from(store.values());
        }),
        updateUnsolvedQuestion: vi.fn(),
      } as any;

      // Inject mocks into use cases
      (questionUseCase as any).questionRepo = mockQuestionRepo;
      (questionUseCase as any).sessionRepo = mockSessionRepo;
      (sessionUseCase as any).questionRepo = mockQuestionRepo;
      (sessionUseCase as any).sessionRepo = mockSessionRepo;
    });

    it('HTTP-01: GET /api/v1/questions/today returns safe DTOs with zero answer keys or explanations', async () => {
      const res = await request(app)
        .get('/api/v1/questions/today')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.questions)).toBe(true);
      expect(res.body.questions.length).toBe(10);

      // Verify serialized JSON payload is strictly sanitized for every single item
      for (const q of res.body.questions) {
        expect(q.questionId).toBeDefined();
        expect(q.topic).toBe('ASHA role');
        expect(q.options).toBeDefined();
        expect(q.options.option_a).toBeDefined();

        expect(q.correct_answer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.action).toBeUndefined();
        expect(q.learning_objective).toBeUndefined();
      }
    });

    it('HTTP-02: GET /api/v1/questions/:id returns safe single Primary question DTO with zero answer keys', async () => {
      const res = await request(app)
        .get('/api/v1/questions/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.question).toBeDefined();
      expect(res.body.question.questionId).toBe('MG-AIA-01-TH');
      expect(res.body.question.questionType).toBe('Primary');
      expect(res.body.question.followUpFor).toBeNull();

      expect(res.body.question.correct_answer).toBeUndefined();
      expect(res.body.question.explanation).toBeUndefined();
      expect(res.body.question.action).toBeUndefined();
      expect(res.body.question.learning_objective).toBeUndefined();
    });

    it('HTTP-03: GET /api/v1/questions/:id returns safe Follow-Up question DTO with referential integrity', async () => {
      const res = await request(app)
        .get('/api/v1/questions/MG-AIA-01-PR')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.question).toBeDefined();
      expect(res.body.question.questionId).toBe('MG-AIA-01-PR');
      expect(res.body.question.questionType).toBe('Follow-Up');
      expect(res.body.question.followUpFor).toBe('MG-AIA-01-TH');

      expect(res.body.question.correct_answer).toBeUndefined();
      expect(res.body.question.explanation).toBeUndefined();
      expect(res.body.question.action).toBeUndefined();
      expect(res.body.question.learning_objective).toBeUndefined();
    });

    it('HTTP-04: GET /api/v1/questions/follow-up/:id validates parent and returns linked sanitized follow-up', async () => {
      const res = await request(app)
        .get('/api/v1/questions/follow-up/MG-AIA-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.question).toBeDefined();
      expect(res.body.question.questionId).toBe('MG-AIA-01-PR');
      expect(res.body.question.questionType).toBe('Follow-Up');
      expect(res.body.question.followUpFor).toBe('MG-AIA-01-TH');

      expect(res.body.question.correct_answer).toBeUndefined();
      expect(res.body.question.explanation).toBeUndefined();
      expect(res.body.question.action).toBeUndefined();
      expect(res.body.question.learning_objective).toBeUndefined();
    });

    it('HTTP-05: GET /api/v1/sessions/today returns sanitized session questions with zero answer leaks', async () => {
      const res = await request(app)
        .get('/api/v1/sessions/today')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.session).toBeDefined();
      expect(Array.isArray(res.body.questions)).toBe(true);
      expect(res.body.questions.length).toBe(10);

      for (const q of res.body.questions) {
        expect(q.questionId).toBeDefined();
        expect(q.options).toBeDefined();
        expect(q.correct_answer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.action).toBeUndefined();
        expect(q.learning_objective).toBeUndefined();
      }
    });

    it('HTTP-06: POST /api/v1/sessions/today/attempts emits feedback strictly inside evaluation object', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/today/attempts')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          sessionId: 'daily_2026-10-15_usr_trai',
          questionId: 'MG-AIA-01-TH',
          questionIndex: 0,
          userAnswerPayload: {
            type: 'MCQ',
            selected_option: 'option_a'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.attemptId).toBe('att_001');

      // Crucial security invariant: Root response payload has NO answer leakage
      expect(res.body.correct_answer).toBeUndefined();
      expect(res.body.explanation).toBeUndefined();
      expect(res.body.action).toBeUndefined();

      // Protected clinical feedback strictly contained within evaluation
      expect(res.body.evaluation).toBeDefined();
      expect(res.body.evaluation.is_correct).toBe(true);
      expect(res.body.evaluation.explanation).toBe('Clinical explanation for question 1.');
      expect(res.body.evaluation.action).toBe('Clinical management action for question 1.');
      expect(res.body.evaluation.correct_answer).toBe('option_a');
    });

    it('HTTP-07: GET /api/v1/questions/unsolved preserves historical Clinical Vault study review contract', async () => {
      const res = await request(app)
        .get('/api/v1/questions/unsolved')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.unsolvedQuestions.length).toBe(1);

      const item = res.body.unsolvedQuestions[0];
      expect(item.record.id).toBe('MG-AIA-01-TH');

      // Remedial study contract requires historical answer and explanation for failed question
      expect(item.mainQuestion.question_id).toBe('MG-AIA-01-TH');
      expect(item.mainQuestion.correct_answer).toBe('option_a');
      expect(item.mainQuestion.explanation).toBe('Clinical explanation for question 1.');
    });

    it('HTTP-08: GET /api/v1/questions/unsolved enforces strict cross-user isolation and ignores client-supplied UID', async () => {
      // User A attempts to view User B's vault by injecting query and body params
      const resUserA = await request(app)
        .get('/api/v1/questions/unsolved?uid=usr_trainee_02')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({ uid: 'usr_trainee_02' });

      expect(resUserA.status).toBe(200);
      expect(resUserA.body.unsolvedQuestions.length).toBe(1);
      // Strictly User A's record, client-supplied uid is completely ignored
      expect(resUserA.body.unsolvedQuestions[0].record.id).toBe('MG-AIA-01-TH');

      // User B receives User B's record
      const resUserB = await request(app)
        .get('/api/v1/questions/unsolved')
        .set('Authorization', `Bearer ${tokenUserB}`);

      expect(resUserB.status).toBe(200);
      expect(resUserB.body.unsolvedQuestions.length).toBe(1);
      expect(resUserB.body.unsolvedQuestions[0].record.id).toBe('MG-AIA-02-TH');
    });

    it('HTTP-09: GET /api/v1/questions/today rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/questions/today');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Authentication required/i);
      expect(res.body.questions).toBeUndefined();
    });

    it('HTTP-10: GET /api/v1/questions/:id returns 404 for nonexistent question ID', async () => {
      const res = await request(app)
        .get('/api/v1/questions/MG-NONEXISTENT-TH')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Question MG-NONEXISTENT-TH not found.');
    });

    it('HTTP-11: GET /api/v1/questions/follow-up/:id returns 404 for nonexistent follow-up parent', async () => {
      const res = await request(app)
        .get('/api/v1/questions/follow-up/MG-NONEXISTENT-TH')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Follow-up question for MG-NONEXISTENT-TH not found.');
    });

    it('HTTP-12: GET /api/v1/questions/follow-up/:id fails closed with 500 on referential topic mismatch', async () => {
      const res = await request(app)
        .get('/api/v1/questions/follow-up/MG-MISMATCH-01-TH')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Data integrity error/i);
      expect(res.body.question).toBeUndefined();
    });

    it('HTTP-13: GET /api/v1/questions/today fails closed with 500 when repository serves malformed record', async () => {
      // Simulate repo returning question with empty option_c
      mockQuestionRepo.getSessionQuestions = vi.fn().mockResolvedValue([
        {
          question_id: 'MG-MALFORMED-TH',
          topic: 'ASHA role',
          category: 'HEART_RECORDING',
          difficulty: 'BEGINNER',
          type: 'MCQ',
          question_type: 'Primary',
          follow_up_for: null,
          question: 'Malformed stem',
          option_a: 'A',
          option_b: 'B',
          option_c: '', // Empty option
          option_d: 'D',
          correct_answer: 'option_a',
          explanation: 'Secret answer explanation',
          action: 'Secret clinical action',
        }
      ]);

      const res = await request(app)
        .get('/api/v1/questions/today')
        .set('Authorization', `Bearer ${tokenUserA}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Data integrity error/i);

      // Verify no question content or answer leaks in error response
      expect(res.body.questions).toBeUndefined();
      expect(res.body.correct_answer).toBeUndefined();
      expect(res.body.explanation).toBeUndefined();
      expect(res.body.action).toBeUndefined();
    });

    it('HTTP-14: POST /api/v1/sessions/today/attempts rejects invalid answer payload with 400 and zero leaks', async () => {
      const res = await request(app)
        .post('/api/v1/sessions/today/attempts')
        .set('Authorization', `Bearer ${tokenUserA}`)
        .send({
          sessionId: 'daily_2026-10-15_usr_trai',
          questionId: 'MG-AIA-01-TH',
          questionIndex: 0,
          userAnswerPayload: {
            type: 'MCQ',
            selected_option: 'option_z' // Invalid option key
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid answer payload format/i);

      // Ensure zero leaks of correct_answer or evaluation on error
      expect(res.body.correct_answer).toBeUndefined();
      expect(res.body.evaluation).toBeUndefined();
      expect(res.body.explanation).toBeUndefined();
      expect(res.body.action).toBeUndefined();
    });
  });
});
