import { IQuestionRepository } from './IQuestionRepository';
import { Question, QuestionCategory, QuestionType } from '../models/question.types';
import { questionApi } from '../api/questionApi';
import { defaultQuestionRepository as mockRepo } from './MockJsonQuestionRepository';

export class ApiQuestionRepository implements IQuestionRepository {
  private cache: Question[] | null = null;

  async getAllQuestions(): Promise<Question[]> {
    if (this.cache && this.cache.length > 0) {
      return this.cache;
    }
    try {
      const questions = await questionApi.getTodayQuestions();
      if (questions && questions.length > 0) {
        this.cache = questions;
        return questions;
      }
    } catch (err) {
      console.warn('[ApiQuestionRepository] Network fetch fallback to mock questions:', err);
    }
    return mockRepo.getAllQuestions();
  }

  async getQuestionById(questionId: string): Promise<Question | null> {
    try {
      const q = await questionApi.getQuestionById(questionId);
      if (q) return q;
    } catch {
      // Fallback
    }
    return mockRepo.getQuestionById(questionId);
  }

  async getQuestionsByCategory(category: QuestionCategory): Promise<Question[]> {
    const all = await this.getAllQuestions();
    return all.filter((q) => q.category === category);
  }

  async getQuestionsByType(type: QuestionType): Promise<Question[]> {
    const all = await this.getAllQuestions();
    return all.filter((q) => q.type === type);
  }

  async getSessionQuestions(count: number = 10): Promise<Question[]> {
    try {
      const questions = await questionApi.getTodayQuestions();
      if (questions && questions.length > 0) {
        return questions.slice(0, count);
      }
    } catch (err) {
      console.warn('[ApiQuestionRepository] Network session fallback to mock questions:', err);
    }
    return mockRepo.getSessionQuestions(count);
  }

  async getFollowUpQuestion(mainQuestionId: string): Promise<Question | null> {
    if (!mainQuestionId) return null;
    try {
      const q = await questionApi.getFollowUpQuestion(mainQuestionId);
      if (q) return q;
    } catch {
      // Fallback to local
    }
    const all = await this.getAllQuestions();
    const found = all.find(
      (q) => q.follow_up_for === mainQuestionId || (q as any).Follow_Up_For === mainQuestionId
    );
    if (found) return found;
    return mockRepo.getFollowUpQuestion(mainQuestionId);
  }
}


export const defaultApiQuestionRepository = new ApiQuestionRepository();
