import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionUseCase } from '../src/application/usecases/SessionUseCase.js';
import { ISessionRepository } from '../src/domain/interfaces/ISessionRepository.js';
import { IQuestionRepository } from '../src/domain/interfaces/IQuestionRepository.js';
import { DailySessionDoc, AttemptDoc, UnsolvedQuestionDoc } from '../src/domain/models/session.model.js';
import { Question } from '../src/domain/models/question.model.js';
import {
  getDailyCycleDate,
  getResolvedCalendarDate,
  getDailyCycleWindow,
  CANONICAL_31_TOPIC_SEQUENCE,
} from '../src/domain/rules/sessionSelection.js';

/**
 * Mock Question Repository with canonical test questions
 */
function createMockQuestionRepo(): IQuestionRepository {
  const mockQuestions: Question[] = [];
  for (let i = 1; i <= 31; i++) {
    const topic = CANONICAL_31_TOPIC_SEQUENCE[i - 1];
    const padded = String(i).padStart(2, '0');
    // Primary question
    mockQuestions.push({
      question_id: `MG-TOPIC-${padded}-TH`,
      topic,
      difficulty_rank: 1,
      type: 'MCQ',
      question_type: 'Primary',
      category: 'DEVICE_HANDLING',
      difficulty: 'BEGINNER',
      follow_up_for: null,
      question: `Primary Question for ${topic}`,
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      correct_option: 'option_a',
      explanation: 'Explanation',
      learning_objective: 'Objective',
      tags: [topic],
      clinician_validated: true,
    } as any);
    // Follow-Up question
    mockQuestions.push({
      question_id: `MG-TOPIC-${padded}-PR`,
      topic,
      difficulty_rank: 1,
      type: 'MCQ',
      question_type: 'Follow-Up',
      category: 'DEVICE_HANDLING',
      difficulty: 'BEGINNER',
      follow_up_for: `MG-TOPIC-${padded}-TH`,
      question: `Follow-Up Question for ${topic}`,
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      correct_option: 'option_a',
      explanation: 'Explanation',
      learning_objective: 'Objective',
      tags: [topic],
      clinician_validated: true,
    } as any);
  }

  return {
    getAllQuestions: vi.fn().mockResolvedValue(mockQuestions),
    getQuestionById: vi.fn().mockImplementation(async (id: string) => {
      return mockQuestions.find((q) => q.question_id === id) || null;
    }),
    getFollowUpQuestion: vi.fn().mockImplementation(async (mainId: string) => {
      return mockQuestions.find((q) => q.follow_up_for === mainId) || null;
    }),
    getSessionQuestions: vi.fn().mockImplementation(async (_dateStr: string, count: number = 10) => {
      return mockQuestions.filter((q) => q.question_type === 'Primary').slice(0, count);
    }),
  };
}

/**
 * Stateful In-Memory Session Repository with transactional semantics
 */
class InMemorySessionRepository implements ISessionRepository {
  sessions = new Map<string, DailySessionDoc>();
  users = new Map<string, any>();
  attempts = new Map<string, AttemptDoc>();
  unsolved = new Map<string, UnsolvedQuestionDoc>();

  async getDailySession(uid: string, sessionId: string): Promise<DailySessionDoc | null> {
    const key = `${uid}:${sessionId}`;
    const s = this.sessions.get(key);
    return s ? JSON.parse(JSON.stringify(s)) : null;
  }

  async createDailySession(session: DailySessionDoc): Promise<void> {
    const key = `${session.uid}:${session.sessionId}`;
    this.sessions.set(key, JSON.parse(JSON.stringify(session)));
  }

  async createDailySessionIfNotExists(session: DailySessionDoc): Promise<{ session: DailySessionDoc; created: boolean }> {
    const key = `${session.uid}:${session.sessionId}`;
    if (this.sessions.has(key)) {
      return { session: JSON.parse(JSON.stringify(this.sessions.get(key)!)), created: false };
    }
    this.sessions.set(key, JSON.parse(JSON.stringify(session)));
    const user = this.users.get(session.uid) || {};
    user.activeSessionId = session.sessionId;
    user.activeSessionTopics = session.selectedTopics || [];
    this.users.set(session.uid, user);
    return { session: JSON.parse(JSON.stringify(session)), created: true };
  }

  async appendAttempt(attempt: AttemptDoc): Promise<void> {
    this.attempts.set(attempt.attemptId, JSON.parse(JSON.stringify(attempt)));
  }

  async updateSessionProgress(uid: string, sessionId: string, updates: Record<string, any>): Promise<void> {
    const key = `${uid}:${sessionId}`;
    const s = this.sessions.get(key);
    if (s) {
      Object.assign(s, JSON.parse(JSON.stringify(updates)));
    }
  }

  async getActiveDailySession(uid: string, targetCycleDate?: string): Promise<DailySessionDoc | null> {
    const user = this.users.get(uid);
    if (user?.activeSessionId) {
      const active = await this.getDailySession(uid, user.activeSessionId);
      if (
        active &&
        active.status === 'IN_PROGRESS' &&
        !active.questionsCompleted &&
        (!targetCycleDate || active.localDate === targetCycleDate)
      ) {
        return active;
      }
    }
    for (const s of this.sessions.values()) {
      if (
        s.uid === uid &&
        s.status === 'IN_PROGRESS' &&
        !s.questionsCompleted &&
        (!targetCycleDate || s.localDate === targetCycleDate)
      ) {
        return JSON.parse(JSON.stringify(s));
      }
    }
    return null;
  }

  async getUser(uid: string): Promise<any | null> {
    const u = this.users.get(uid);
    return u ? JSON.parse(JSON.stringify(u)) : null;
  }

  async updateUser(uid: string, updates: Record<string, any>): Promise<void> {
    const u = this.users.get(uid) || {};
    Object.assign(u, JSON.parse(JSON.stringify(updates)));
    this.users.set(uid, u);
  }

  async recordAttemptAtomic(params: any): Promise<any> {
    const sessionKey = `${params.uid}:${params.sessionId}`;
    const session = this.sessions.get(sessionKey);
    if (!session) throw new Error('Session not found');

    const isCorrect = params.evaluation?.isCorrect ?? true;
    const isPrimary = !params.questionId.endsWith('-PR');
    const xpAwarded = isCorrect ? (isPrimary ? 5 : 3) : 0;
    const nextIndex = params.questionIndex + (isCorrect ? 1 : 0);
    const isComplete = nextIndex >= (session.questionIds?.length || 10);

    session.currentQuestionIndex = nextIndex;
    session.totalXpEarned = (session.totalXpEarned || 0) + xpAwarded;
    if (isCorrect) session.correctCount = (session.correctCount || 0) + 1;
    if (isComplete) {
      session.questionsCompleted = true;
      session.status = 'QUESTIONS_COMPLETED';
    }

    // Update user stats
    const user = this.users.get(params.uid) || { learningState: {} };
    if (!user.learningState) user.learningState = {};
    user.learningState.totalXp = (user.learningState.totalXp || 0) + xpAwarded;
    if (isCorrect) {
      user.learningState.completedQuestionsCount = (user.learningState.completedQuestionsCount || 0) + 1;
    }
    if (!Array.isArray(user.lifetimeCompletedQuestionIds)) {
      user.lifetimeCompletedQuestionIds = [];
    }
    if (isCorrect && !user.lifetimeCompletedQuestionIds.includes(params.questionId)) {
      user.lifetimeCompletedQuestionIds.push(params.questionId);
    }
    this.users.set(params.uid, user);

    const attemptId = `att_${Date.now()}_${params.questionIndex}`;
    this.attempts.set(attemptId, {
      attemptId,
      dailySessionId: params.sessionId,
      uid: params.uid,
      userId: params.uid,
      questionId: params.questionId,
      contentReleaseId: 'rel_v1_0_0',
      questionIndex: params.questionIndex,
      userAnswerPayload: params.userAnswerPayload,
      result: isCorrect ? 'CORRECT' : 'INCORRECT',
      xpAwarded,
      powerUpsActive: [],
      clientTimestamp: Date.now(),
    });

    return {
      attemptId,
      currentQuestionIndex: session.currentQuestionIndex,
      isSessionComplete: isComplete,
      totalXpEarned: session.totalXpEarned,
      correctCount: session.correctCount,
      result: isCorrect ? 'CORRECT' : 'INCORRECT',
      xpAwarded,
      branchState: 'MAIN',
      status: session.status,
      questionsCompleted: session.questionsCompleted,
    };
  }

  async finalizeSessionAtomic(params: any): Promise<any> {
    const sessionKey = `${params.uid}:${params.sessionId}`;
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.status = 'REVIEW_COMPLETED';
      session.reviewViewed = true;
    }
    const user = this.users.get(params.uid) || {};
    user.activeSessionId = null;
    return { success: true, alreadyFinalized: false };
  }

  async getSessionAttempts(uid: string, sessionId: string): Promise<AttemptDoc[]> {
    return Array.from(this.attempts.values()).filter(
      (a) => a.uid === uid && a.dailySessionId === sessionId
    );
  }

  async reconcileSessionProgressAtomic(uid: string, sessionId: string): Promise<DailySessionDoc> {
    const s = await this.getDailySession(uid, sessionId);
    return s!;
  }

  async getUnsolvedQuestions(uid: string): Promise<UnsolvedQuestionDoc[]> {
    return Array.from(this.unsolved.values()).filter((u) => u.uid === uid);
  }

  async updateUnsolvedQuestion(uid: string, questionId: string, updates: any): Promise<UnsolvedQuestionDoc> {
    const key = `${uid}:${questionId}`;
    const item = this.unsolved.get(key) || { uid, mainQuestionId: questionId, isResolved: false, failCount: 1 } as any;
    Object.assign(item, updates);
    this.unsolved.set(key, item);
    return item;
  }
}

describe('AiSteth Academy — Daily Question Reset Engine (9:00 AM IST Cycle)', () => {
  let sessionRepo: InMemorySessionRepository;
  let questionRepo: IQuestionRepository;
  let sessionUseCase: SessionUseCase;
  const testUid = 'usr_trainee_saturday_01';

  beforeEach(() => {
    sessionRepo = new InMemorySessionRepository();
    questionRepo = createMockQuestionRepo();
    sessionUseCase = new SessionUseCase(sessionRepo, questionRepo);

    sessionRepo.users.set(testUid, {
      uid: testUid,
      displayName: 'Trainee Saturday',
      learningState: {
        totalXp: 100,
        currentLevel: 2,
        currentStreak: 3,
        longestStreak: 5,
        lastActiveDate: '2026-10-16',
        completedQuestionsCount: 20,
        completedSessionsCount: 2,
      },
      topicQueue: [...CANONICAL_31_TOPIC_SEQUENCE],
      lifetimeCompletedQuestionIds: [],
    });
  });

  // TEST 1 — PARTIAL COMPLETION:
  // User completes 7/10 questions on Saturday.
  // User returns Monday after 09:00 IST.
  // Expected: 0/10 completed in the current cycle.
  it('TEST 1 — PARTIAL COMPLETION: user completes 7/10 questions on Saturday; returns Monday after 09:00 IST; receives 0/10 completed in fresh cycle', async () => {
    const saturdayCycle = '2026-10-17';
    const mondayCycle = '2026-10-19';

    // Saturday: Initialize session and complete 7 questions
    const satResult = await sessionUseCase.getOrCreateTodaySession(testUid, saturdayCycle);
    expect(satResult.session.localDate).toBe(saturdayCycle);
    expect(satResult.questions).toHaveLength(10);

    for (let i = 0; i < 7; i++) {
      await sessionUseCase.recordAttempt(testUid, {
        sessionId: satResult.session.sessionId,
        questionId: satResult.questions[i].question_id,
        questionIndex: i,
        userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      });
    }

    // Verify Saturday progress: 7 completed, not finished
    const satSession = await sessionRepo.getDailySession(testUid, satResult.session.sessionId);
    expect(satSession?.currentQuestionIndex).toBe(7);
    expect(satSession?.questionsCompleted).toBe(false);
    expect(satSession?.status).toBe('IN_PROGRESS');

    // Monday after 09:00 IST: User requests today's session
    const monResult = await sessionUseCase.getOrCreateTodaySession(testUid, mondayCycle);

    // Assert: Fresh cycle for Monday with 0/10 completed
    expect(monResult.session.localDate).toBe(mondayCycle);
    expect(monResult.session.sessionId).not.toBe(satResult.session.sessionId);
    expect(monResult.session.currentQuestionIndex).toBe(0);
    expect(monResult.session.questionsCompleted).toBe(false);
    expect(monResult.session.status).toBe('IN_PROGRESS');
    expect(monResult.questions).toHaveLength(10);

    // Saturday session is preserved untouched
    const satAfter = await sessionRepo.getDailySession(testUid, satResult.session.sessionId);
    expect(satAfter?.currentQuestionIndex).toBe(7);
    expect(satAfter?.questionsCompleted).toBe(false);
  });

  // TEST 2 — COMPLETION:
  // User completes all 10 questions in one cycle.
  // Expected: "Done for the day" is displayed for that cycle.
  it('TEST 2 — COMPLETION: user completes all 10 questions in one cycle; displays completed status ("Done for the day")', async () => {
    const cycle = '2026-10-19';
    const initResult = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);
    expect(initResult.questions).toHaveLength(10);

    let lastAttemptResult: any;
    for (let i = 0; i < 10; i++) {
      lastAttemptResult = await sessionUseCase.recordAttempt(testUid, {
        sessionId: initResult.session.sessionId,
        questionId: initResult.questions[i].question_id,
        questionIndex: i,
        userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      });
    }

    expect(lastAttemptResult.isSessionComplete).toBe(true);
    expect(lastAttemptResult.questionsCompleted).toBe(true);
    expect(lastAttemptResult.status).toBe('QUESTIONS_COMPLETED');

    // Subsequent retrieval during same cycle reflects completed status
    const recoveryResult = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);
    expect(recoveryResult.session.questionsCompleted).toBe(true);
    expect(recoveryResult.session.status).toBe('QUESTIONS_COMPLETED');
    expect(recoveryResult.session.currentQuestionIndex).toBe(10);
  });

  // TEST 3 — NEXT CYCLE:
  // The same user returns after the next 09:00 IST boundary.
  // Expected: a fresh cycle with 0/10 completed.
  it('TEST 3 — NEXT CYCLE: returns after the next 09:00 IST boundary; receives fresh cycle with 0/10 completed', async () => {
    const mondayCycle = '2026-10-19';
    const tuesdayCycle = '2026-10-20';

    // Complete all 10 on Monday
    const mon = await sessionUseCase.getOrCreateTodaySession(testUid, mondayCycle);
    for (let i = 0; i < 10; i++) {
      await sessionUseCase.recordAttempt(testUid, {
        sessionId: mon.session.sessionId,
        questionId: mon.questions[i].question_id,
        questionIndex: i,
        userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      });
    }

    // Tuesday after 09:00 IST: Returns for Tuesday
    const tue = await sessionUseCase.getOrCreateTodaySession(testUid, tuesdayCycle);
    expect(tue.session.localDate).toBe(tuesdayCycle);
    expect(tue.session.sessionId).not.toBe(mon.session.sessionId);
    expect(tue.session.currentQuestionIndex).toBe(0);
    expect(tue.session.questionsCompleted).toBe(false);
    expect(tue.session.status).toBe('IN_PROGRESS');
    expect(tue.questions).toHaveLength(10);
  });

  // TEST 4 — BOUNDARY BEFORE 09:00:
  // At 08:59 IST, the previous cycle remains active.
  it('TEST 4 — BOUNDARY BEFORE 09:00: at 08:59:59 IST, previous cycle remains active', () => {
    // 2026-10-19 08:59:59.999 IST = 2026-10-19 03:29:59.999 UTC
    const beforeBoundary = new Date('2026-10-19T08:59:59.999+05:30');
    const cycleDate = getDailyCycleDate(beforeBoundary);
    expect(cycleDate).toBe('2026-10-18');
  });

  // TEST 5 — EXACT BOUNDARY:
  // At 09:00 IST, the new cycle becomes active.
  it('TEST 5 — EXACT BOUNDARY: at 09:00:00 IST, new cycle becomes active', () => {
    // 2026-10-19 09:00:00.000 IST = 2026-10-19 03:30:00.000 UTC
    const exactBoundary = new Date('2026-10-19T09:00:00.000+05:30');
    const cycleDate = getDailyCycleDate(exactBoundary);
    expect(cycleDate).toBe('2026-10-19');
  });

  // TEST 6 — BOUNDARY AFTER 09:00:
  // At 09:01 IST, the new cycle remains active.
  it('TEST 6 — BOUNDARY AFTER 09:00: at 09:01:00 IST, new cycle remains active', () => {
    // 2026-10-19 09:01:00.000 IST
    const afterBoundary = new Date('2026-10-19T09:01:00.000+05:30');
    const cycleDate = getDailyCycleDate(afterBoundary);
    expect(cycleDate).toBe('2026-10-19');
  });

  // TEST 7 — UTC/IST DIFFERENCE:
  // Verify correct behavior when the corresponding UTC date differs from the Indian calendar date.
  it('TEST 7 — UTC/IST DIFFERENCE: correctly derives cycle when UTC date differs from Indian calendar date', () => {
    // Case A: 2026-10-19 02:00:00 IST -> UTC is 2026-10-18 20:30:00 UTC (UTC date is 18th, IST date is 19th)
    // Before 09:00 IST, cycle belongs to 2026-10-18
    const earlyMorningIST = new Date('2026-10-19T02:00:00.000+05:30');
    expect(getDailyCycleDate(earlyMorningIST)).toBe('2026-10-18');

    // Case B: 2026-10-19 23:45:00 IST -> UTC is 2026-10-19 18:15:00 UTC (both are 19th)
    // After 09:00 IST, cycle belongs to 2026-10-19
    const lateNightIST = new Date('2026-10-19T23:45:00.000+05:30');
    expect(getDailyCycleDate(lateNightIST)).toBe('2026-10-19');

    // Case C: 2026-10-20 01:30:00 IST -> UTC is 2026-10-19 20:00:00 UTC (UTC date is 19th, IST date is 20th)
    // Before Tuesday 09:00 IST, Monday's 2026-10-19 cycle is STILL ACTIVE!
    const postMidnightIST = new Date('2026-10-20T01:30:00.000+05:30');
    expect(getDailyCycleDate(postMidnightIST)).toBe('2026-10-19');
  });

  // TEST 8 — MULTIPLE MISSED DAYS:
  // A user who returns after several days receives the current daily cycle,
  // without needing every missed cycle to be processed individually.
  it('TEST 8 — MULTIPLE MISSED DAYS: returning after 5 days immediately receives current cycle without sequential backlog', async () => {
    // User last active on 2026-10-10
    const initialSession = await sessionUseCase.getOrCreateTodaySession(testUid, '2026-10-10');
    expect(initialSession.session.localDate).toBe('2026-10-10');

    // User returns on 2026-10-16 (6 days later)
    const returnedSession = await sessionUseCase.getOrCreateTodaySession(testUid, '2026-10-16');
    expect(returnedSession.session.localDate).toBe('2026-10-16');
    expect(returnedSession.session.currentQuestionIndex).toBe(0);
    expect(returnedSession.session.questionsCompleted).toBe(false);
    expect(returnedSession.questions).toHaveLength(10);
  });

  // TEST 9 — REPEATED API REQUESTS:
  // Repeated requests during one cycle do not reset the user's progress.
  it('TEST 9 — REPEATED API REQUESTS: multiple requests during the same cycle preserve in-progress state', async () => {
    const cycle = '2026-10-19';
    const initResult = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);

    // User completes 3 questions
    for (let i = 0; i < 3; i++) {
      await sessionUseCase.recordAttempt(testUid, {
        sessionId: initResult.session.sessionId,
        questionId: initResult.questions[i].question_id,
        questionIndex: i,
        userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      });
    }

    // Repeated request 1
    const repeat1 = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);
    expect(repeat1.session.currentQuestionIndex).toBe(3);
    expect(repeat1.session.totalXpEarned).toBe(15);
    expect(repeat1.session.sessionId).toBe(initResult.session.sessionId);

    // Repeated request 2
    const repeat2 = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);
    expect(repeat2.session.currentQuestionIndex).toBe(3);
    expect(repeat2.session.totalXpEarned).toBe(15);
    expect(repeat2.session.sessionId).toBe(initResult.session.sessionId);
  });

  // TEST 10 — CONCURRENT REQUESTS:
  // Simultaneous requests around a cycle transition do not cause duplicate
  // allocations or inconsistent progress.
  it('TEST 10 — CONCURRENT REQUESTS: simultaneous requests yield identical session and allocate exactly 10 slots', async () => {
    const cycle = '2026-10-19';

    // Simulate 5 simultaneous requests arriving at the same millisecond
    const concurrentPromises = [
      sessionUseCase.getOrCreateTodaySession(testUid, cycle),
      sessionUseCase.getOrCreateTodaySession(testUid, cycle),
      sessionUseCase.getOrCreateTodaySession(testUid, cycle),
      sessionUseCase.getOrCreateTodaySession(testUid, cycle),
      sessionUseCase.getOrCreateTodaySession(testUid, cycle),
    ];

    const results = await Promise.all(concurrentPromises);

    // All results must have the identical session ID
    const firstSessionId = results[0].session.sessionId;
    for (const res of results) {
      expect(res.session.sessionId).toBe(firstSessionId);
      expect(res.session.questionIds).toHaveLength(10);
      expect(res.questions).toHaveLength(10);
      expect(res.session.questionIds).toEqual(results[0].session.questionIds);
    }

    // Verify only ONE session document exists in store for this user and cycle
    const allUserSessions = Array.from(sessionRepo.sessions.values()).filter(
      (s) => s.uid === testUid && s.localDate === cycle
    );
    expect(allUserSessions).toHaveLength(1);
  });

  // TEST 11 — XP AND HISTORY:
  // Daily reset does not reduce XP, level, mastery, or historical records.
  it('TEST 11 — XP AND HISTORY: daily cycle reset preserves total XP, level, and past attempt history', async () => {
    const userBefore = await sessionRepo.getUser(testUid);
    const initialXp = userBefore.learningState.totalXp;
    expect(initialXp).toBe(100);

    // Cycle 1: Saturday (complete 7 questions -> +35 XP)
    const sat = await sessionUseCase.getOrCreateTodaySession(testUid, '2026-10-17');
    for (let i = 0; i < 7; i++) {
      await sessionUseCase.recordAttempt(testUid, {
        sessionId: sat.session.sessionId,
        questionId: sat.questions[i].question_id,
        questionIndex: i,
        userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
      });
    }

    const userAfterSat = await sessionRepo.getUser(testUid);
    expect(userAfterSat.learningState.totalXp).toBe(135);

    // Cycle 2: Monday (reset happens)
    const mon = await sessionUseCase.getOrCreateTodaySession(testUid, '2026-10-19');
    expect(mon.session.totalXpEarned).toBe(0); // Fresh session XP

    // Lifetime XP is completely preserved!
    const userAfterReset = await sessionRepo.getUser(testUid);
    expect(userAfterReset.learningState.totalXp).toBe(135);
    expect(userAfterReset.learningState.currentLevel).toBe(2);

    // Past Saturday attempts are intact in history
    const satAttempts = await sessionRepo.getSessionAttempts(testUid, sat.session.sessionId);
    expect(satAttempts).toHaveLength(7);
  });

  // TEST 12 — EXISTING LEARNING RULES:
  // Verify Primary/Follow-Up behavior, review scheduling, wrong-answer pools,
  // and session recovery remain intact.
  it('TEST 12 — EXISTING LEARNING RULES: Primary question selection from 31 topics and recovery within cycle remain intact', async () => {
    const cycle = '2026-10-19';
    const result = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);

    // 10 Primary questions selected
    expect(result.questions).toHaveLength(10);
    for (const q of result.questions) {
      expect(q.questionType).toBe('Primary');
      expect(q.followUpFor).toBeNull();
    }

    // Answering correctly advances to question index 1
    const attempt = await sessionUseCase.recordAttempt(testUid, {
      sessionId: result.session.sessionId,
      questionId: result.questions[0].question_id,
      questionIndex: 0,
      userAnswerPayload: { type: 'MCQ', selected_option: 'option_a' },
    });
    expect(attempt.result).toBe('CORRECT');
    expect(attempt.questionIndex).toBe(1);

    // Recovery within same cycle restores index 1
    const recovered = await sessionUseCase.getOrCreateTodaySession(testUid, cycle);
    expect(recovered.session.currentQuestionIndex).toBe(1);
    expect(recovered.session.sessionId).toBe(result.session.sessionId);
  });
});
