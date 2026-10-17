/**
 * AiSteth Academy - Question Service
 * Business logic layer isolating UI components from repository details.
 */

import { IQuestionRepository } from '../repositories/IQuestionRepository';
import { defaultApiQuestionRepository } from '../repositories/ApiQuestionRepository';
import { ISessionGenerator, DummySessionGenerator } from './ISessionGenerator';
import { Question, QuestionCategory, QuestionType } from '../models/question.types';
import { SESSION_CONFIG, StoredSessionRecord } from '../models/session.types';

export class QuestionService {
  private repository: IQuestionRepository;
  private sessionGenerator: ISessionGenerator;

  constructor(
    repository: IQuestionRepository = defaultApiQuestionRepository,
    sessionGenerator: ISessionGenerator = new DummySessionGenerator()
  ) {
    this.repository = repository;
    this.sessionGenerator = sessionGenerator;
  }

  /**
   * Generates a daily training session with the configured question length (default: 10).
   */
  async createDailySession(
    count: number = SESSION_CONFIG.DEFAULT_SESSION_LENGTH,
    userHistory: StoredSessionRecord[] = []
  ): Promise<Question[]> {
    const allQuestions = await this.repository.getAllQuestions();
    return this.sessionGenerator.generateSession(allQuestions, userHistory, count);
  }

  async getQuestionById(questionId: string): Promise<Question | null> {
    return this.repository.getQuestionById(questionId);
  }

  async getFollowUpQuestion(mainQuestionId: string): Promise<Question | null> {
    return this.repository.getFollowUpQuestion(mainQuestionId);
  }

  async getQuestionsByCategory(category: QuestionCategory): Promise<Question[]> {
    return this.repository.getQuestionsByCategory(category);
  }

  async getQuestionsByType(type: QuestionType): Promise<Question[]> {
    return this.repository.getQuestionsByType(type);
  }

  async getTotalQuestionCount(): Promise<number> {
    const all = await this.repository.getAllQuestions();
    return all.length;
  }
}

export const defaultQuestionService = new QuestionService();
