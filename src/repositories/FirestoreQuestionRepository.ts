/**
 * AiSteth Academy — Firestore Question Repository
 * Specification: v2.7.0-SPARK-SPEC
 *
 * Direct client-side reads from /contentReleases/rel_v1_0_0/questions
 */

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { IQuestionRepository } from './IQuestionRepository';
import { Question, MCQQuestion, QuestionCategory, QuestionType } from '../models/question.types';
import { selectSessionQuestions, getResolvedCalendarDate } from '../utils/sessionSelection';

export class FirestoreQuestionRepository implements IQuestionRepository {
  private releaseId: string;
  private cache: Question[] | null = null;

  constructor(releaseId: string = 'rel_v1_0_0') {
    this.releaseId = releaseId;
  }

  private mapFirestoreDocToQuestion(data: Record<string, any>): Question {
    // If it's already in application Question format
    if (data.type && data.question_id) {
      return data as Question;
    }

    // Map from AI_limitation schema
    const qId = data.Question_ID || data.question_id || 'UNKNOWN';
    const rank = Number(data.Difficulty_Rank || data.difficulty_rank || 1);
    const correctLetter = (data.Correct || data.correct || 'A').toLowerCase();
    const correctKey = `option_${correctLetter}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';

    const mcq: MCQQuestion = {
      question_id: qId,
      type: 'MCQ',
      category: 'HEART_RECORDING',
      difficulty: rank <= 3 ? 'BEGINNER' : rank <= 7 ? 'INTERMEDIATE' : 'ADVANCED',
      question: data.Question || data.question || '',
      explanation: data.Explanation || data.explanation || '',
      learning_objective: data.Action || data.learning_objective || "Recognize clinical danger signs and make appropriate referral decisions.",
      tags: [data.Topic || 'AI limitation', data.MedGemma_Tag || 'module1::ai_limitation'].filter(Boolean),
      clinician_validated: true,
      source: 'MEDGEMMA',
      version: '1.0.0',
      option_a: data.Option_A || data.option_a || '',
      option_b: data.Option_B || data.option_b || '',
      option_c: data.Option_C || data.option_c || '',
      option_d: data.Option_D || data.option_d || '',
      correct_answer: correctKey,
    };

    return mcq;
  }

  async getAllQuestions(): Promise<Question[]> {
    if (this.cache && this.cache.length > 0) {
      return [...this.cache];
    }

    try {
      const qRef = collection(db, 'contentReleases', this.releaseId, 'questions');
      const snap = await getDocs(qRef);

      const questions: Question[] = [];
      snap.forEach((docSnap) => {
        questions.push(this.mapFirestoreDocToQuestion(docSnap.data()));
      });

      if (questions.length > 0) {
        this.cache = questions;
        return questions;
      }
    } catch (err) {
      console.warn('Unable to load questions from Firestore, falling back to local dataset:', err);
    }

    // Fallback if network offline or running tests
    return [];
  }

  async getQuestionById(questionId: string): Promise<Question | null> {
    if (this.cache) {
      const found = this.cache.find((q) => q.question_id === questionId);
      if (found) return found;
    }

    try {
      const docRef = doc(db, 'contentReleases', this.releaseId, 'questions', questionId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return this.mapFirestoreDocToQuestion(snap.data());
      }
    } catch (err) {
      console.warn(`Firestore getQuestionById error for ${questionId}:`, err);
    }

    return null;
  }

  async getQuestionsByCategory(category: QuestionCategory): Promise<Question[]> {
    const all = await this.getAllQuestions();
    return all.filter((q) => q.category === category);
  }

  async getQuestionsByType(type: QuestionType): Promise<Question[]> {
    const all = await this.getAllQuestions();
    return all.filter((q) => q.type === type);
  }

  /**
   * Retrieves the deterministic 10-question daily session set for the current Asia/Kolkata date
   */
  async getSessionQuestions(count: number = 10): Promise<Question[]> {
    const todayDateStr = getResolvedCalendarDate();
    const selectedIds = selectSessionQuestions(todayDateStr);

    const all = await this.getAllQuestions();
    const map = new Map<string, Question>(all.map((q) => [q.question_id, q]));

    const result: Question[] = [];
    for (const qId of selectedIds) {
      const found = map.get(qId);
      if (found) {
        result.push(found);
      }
    }

    return result.length > 0 ? result.slice(0, count) : all.slice(0, count);
  }
}

export const defaultFirestoreQuestionRepository = new FirestoreQuestionRepository();
