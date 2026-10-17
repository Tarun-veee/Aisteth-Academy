import { Question } from '../models/question.model.js';

export interface IQuestionRepository {
  getAllQuestions(releaseId?: string): Promise<Question[]>;
  getQuestionById(questionId: string, releaseId?: string): Promise<Question | null>;
  getSessionQuestions(dateStr: string, count?: number): Promise<Question[]>;
  getDailyMainQuestions(lifetimeCompletedQuestionIds?: string[], count?: number, releaseId?: string): Promise<Question[]>;
  getFollowUpQuestion(mainQuestionId: string, releaseId?: string): Promise<Question | null>;
}
