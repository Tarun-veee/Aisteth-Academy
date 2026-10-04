import { describe, it, expect } from 'vitest';
import { MockJsonQuestionRepository } from '../src/repositories/MockJsonQuestionRepository';
import { QuestionService } from '../src/services/QuestionService';
import { DummySessionGenerator } from '../src/services/ISessionGenerator';
import dummyQuestions from '../src/data/dummy_questions.json';

describe('Question Repository & Service Layer', () => {
  const repo = new MockJsonQuestionRepository();
  const service = new QuestionService(repo, new DummySessionGenerator());

  it('loads all 15 dummy questions correctly', async () => {
    const all = await repo.getAllQuestions();
    expect(all.length).toBe(15);
  });

  it('filters questions by category properly', async () => {
    const deviceHandling = await repo.getQuestionsByCategory('DEVICE_HANDLING');
    expect(deviceHandling.length).toBeGreaterThan(0);
    deviceHandling.forEach((q) => expect(q.category).toBe('DEVICE_HANDLING'));
  });

  it('filters questions by type properly', async () => {
    const mcqs = await repo.getQuestionsByType('MCQ');
    expect(mcqs.length).toBe(3);
    mcqs.forEach((q) => expect(q.type).toBe('MCQ'));

    const audios = await repo.getQuestionsByType('AUDIO_DISCRIMINATION');
    expect(audios.length).toBe(3);
    audios.forEach((q) => expect(q.type).toBe('AUDIO_DISCRIMINATION'));
  });

  it('generates a balanced 10-question daily session including all 5 question types', async () => {
    const sessionQuestions = await service.createDailySession(10);
    expect(sessionQuestions.length).toBe(10);

    const typesInSession = new Set(sessionQuestions.map((q) => q.type));
    expect(typesInSession.has('MCQ')).toBe(true);
    expect(typesInSession.has('TRUE_FALSE')).toBe(true);
    expect(typesInSession.has('IMAGE_TAP')).toBe(true);
    expect(typesInSession.has('STEP_ORDER')).toBe(true);
    expect(typesInSession.has('AUDIO_DISCRIMINATION')).toBe(true);
  });

  it('ensures all dummy questions have source DEMO and clinician_validated false', () => {
    dummyQuestions.forEach((q) => {
      expect(q.source).toBe('DEMO');
      expect(q.clinician_validated).toBe(false);
      expect(q.version).toBe('1.0.0');
    });
  });

  // TEST 10-14: Daily Session State and Review Lifecycle
  it('correctly handles daily session persistence and one-time review state transitions (TEST 10-14)', async () => {
    const { StorageRepository, getLocalTodayDateString } = await import('../src/repositories/StorageRepository');
    const storage = new StorageRepository();
    const today = getLocalTodayDateString();

    // TEST 14: Save partial 5-question progress and retrieve
    const partialSession = {
      sessionId: `daily_${today}`,
      date: today,
      status: 'IN_PROGRESS' as const,
      questionsCompleted: false,
      reviewViewed: false,
      currentIndex: 5,
      questions: (await repo.getAllQuestions()).slice(0, 10),
      history: [],
      score: 4,
      totalQuestions: 10,
      totalXpEarned: 35,
      correctCount: 4,
    };
    await storage.saveDailySession(partialSession);
    const retrievedPartial = await storage.getDailySession(today);
    expect(retrievedPartial).not.toBeNull();
    expect(retrievedPartial?.currentIndex).toBe(5);
    expect(retrievedPartial?.status).toBe('IN_PROGRESS');

    // TEST 10: Complete all 10 questions -> QUESTIONS_COMPLETED
    const completedQuestions = {
      ...partialSession,
      status: 'QUESTIONS_COMPLETED' as const,
      questionsCompleted: true,
      reviewViewed: false,
      currentIndex: 10,
    };
    await storage.saveDailySession(completedQuestions);
    const retrievedCompleted = await storage.getDailySession(today);
    expect(retrievedCompleted?.status).toBe('QUESTIONS_COMPLETED');
    expect(retrievedCompleted?.questionsCompleted).toBe(true);
    expect(retrievedCompleted?.reviewViewed).toBe(false);

    // TEST 11-13: Press Done on review -> REVIEW_VIEWED (Locked)
    const finalizedReview = {
      ...completedQuestions,
      status: 'REVIEW_VIEWED' as const,
      reviewViewed: true,
    };
    await storage.saveDailySession(finalizedReview);
    const retrievedFinal = await storage.getDailySession(today);
    expect(retrievedFinal?.status).toBe('REVIEW_VIEWED');
    expect(retrievedFinal?.reviewViewed).toBe(true);
  });
});
