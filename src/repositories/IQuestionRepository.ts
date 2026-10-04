/**
 * AiSteth Academy - Question Repository Interface
 * Defines the contract for fetching questions from any underlying source (Mock JSON, IndexedDB, Firestore).
 */

import { Question, QuestionCategory, QuestionType } from '../models/question.types';

export interface IQuestionRepository {
  /**
   * Retrieves all available questions in the question bank.
   */
  getAllQuestions(): Promise<Question[]>;

  /**
   * Retrieves a single question by its unique ID.
   */
  getQuestionById(questionId: string): Promise<Question | null>;

  /**
   * Retrieves a subset of questions filtered by category.
   */
  getQuestionsByCategory(category: QuestionCategory): Promise<Question[]>;

  /**
   * Retrieves a subset of questions filtered by interaction type.
   */
  getQuestionsByType(type: QuestionType): Promise<Question[]>;

  /**
   * Retrieves a balanced batch of questions for a learning session.
   */
  getSessionQuestions(count: number): Promise<Question[]>;
}
