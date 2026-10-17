import { apiFetch } from './client';
import { Question, normalizeQuestion } from '../models/question.types';
import { UnsolvedQuestionItem, UnsolvedQuestionDoc, ReviewStatus } from '../models/session.types';

export interface GetUnsolvedQuestionsApiResponse {
  success: boolean;
  unsolvedQuestions: UnsolvedQuestionItem[];
  totalCount: number;
}

export interface UpdateUnsolvedQuestionApiPayload {
  reviewStatus?: ReviewStatus;
  reviewNotes?: string;
  isResolved?: boolean;
}

export interface UpdateUnsolvedQuestionApiResponse {
  success: boolean;
  updatedRecord: UnsolvedQuestionDoc;
}

export const questionApi = {
  async getTodayQuestions(date?: string): Promise<Question[]> {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await apiFetch<{ questions: Question[] }>(`/questions/today${query}`, {
      method: 'GET',
    });
    return Array.isArray(res.questions) ? res.questions.map(normalizeQuestion) : [];
  },

  async getQuestionById(questionId: string): Promise<Question | null> {
    try {
      const res = await apiFetch<{ question: Question }>(`/questions/${encodeURIComponent(questionId)}`, {
        method: 'GET',
      });
      return res.question ? normalizeQuestion(res.question) : null;
    } catch {
      return null;
    }
  },

  async getFollowUpQuestion(mainQuestionId: string): Promise<Question | null> {
    try {
      const res = await apiFetch<{ question: Question }>(`/questions/follow-up/${encodeURIComponent(mainQuestionId)}`, {
        method: 'GET',
      });
      return res.question ? normalizeQuestion(res.question) : null;
    } catch {
      return null;
    }
  },

  async getUnsolvedQuestions(): Promise<GetUnsolvedQuestionsApiResponse> {
    return apiFetch<GetUnsolvedQuestionsApiResponse>('/questions/unsolved', {
      method: 'GET',
    });
  },

  async updateUnsolvedQuestion(
    questionId: string,
    updates: UpdateUnsolvedQuestionApiPayload
  ): Promise<UpdateUnsolvedQuestionApiResponse> {
    return apiFetch<UpdateUnsolvedQuestionApiResponse>(`/questions/unsolved/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};

