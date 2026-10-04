/**
 * AiSteth Academy - Mock JSON Question Repository
 * Phase 1 implementation of IQuestionRepository backed by bundled dummy questions dataset.
 */

import { IQuestionRepository } from './IQuestionRepository';
import { Question, QuestionCategory, QuestionType } from '../models/question.types';
import dummyQuestionsData from '../data/dummy_questions.json';

export class MockJsonQuestionRepository implements IQuestionRepository {
  private questions: Question[];

  constructor(customQuestions?: Question[]) {
    this.questions = (customQuestions || dummyQuestionsData) as Question[];
  }

  async getAllQuestions(): Promise<Question[]> {
    // Clone to prevent external mutations
    return JSON.parse(JSON.stringify(this.questions));
  }

  async getQuestionById(questionId: string): Promise<Question | null> {
    const found = this.questions.find((q) => q.question_id === questionId);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async getQuestionsByCategory(category: QuestionCategory): Promise<Question[]> {
    const filtered = this.questions.filter((q) => q.category === category);
    return JSON.parse(JSON.stringify(filtered));
  }

  async getQuestionsByType(type: QuestionType): Promise<Question[]> {
    const filtered = this.questions.filter((q) => q.type === type);
    return JSON.parse(JSON.stringify(filtered));
  }

  async getSessionQuestions(count: number): Promise<Question[]> {
    const all = await this.getAllQuestions();
    
    // Create a balanced selection ensuring representation across types
    const types: QuestionType[] = ['MCQ', 'TRUE_FALSE', 'IMAGE_TAP', 'STEP_ORDER', 'AUDIO_DISCRIMINATION'];
    const selected: Question[] = [];

    // First, pick at least one of each type if available
    types.forEach((t) => {
      const ofType = all.filter((q) => q.type === t);
      if (ofType.length > 0) {
        selected.push(ofType[0]);
      }
    });

    // Fill remaining up to `count` with other questions
    const remaining = all.filter((q) => !selected.some((s) => s.question_id === q.question_id));
    for (const q of remaining) {
      if (selected.length >= count) break;
      selected.push(q);
    }

    return selected.slice(0, count);
  }
}

// Export singleton instance for app-wide use
export const defaultQuestionRepository = new MockJsonQuestionRepository();
