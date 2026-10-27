import { apiFetch } from './client';
import {
  AdminOverviewStats,
  ListLearnersQuery,
  ListLearnersResult,
  LearnerSummaryItem,
  SingleLearnerInput,
  BulkLearnerRowInput,
  BulkImportResult,
  WhatsAppOnboardingResult
} from '../models/admin.types';

export const adminApi = {
  getOverview: async (): Promise<{ success: boolean; stats: AdminOverviewStats }> => {
    return apiFetch<{ success: boolean; stats: AdminOverviewStats }>('/admin/overview');
  },

  listLearners: async (query: ListLearnersQuery = {}): Promise<ListLearnersResult> => {
    const params = new URLSearchParams();
    if (query.page) params.append('page', String(query.page));
    if (query.limit) params.append('limit', String(query.limit));
    if (query.search) params.append('search', query.search);
    if (query.status) params.append('status', query.status);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<ListLearnersResult>(`/admin/learners${queryString}`);
  },

  getLearnerDetails: async (uid: string): Promise<{ success: boolean; learner: LearnerSummaryItem }> => {
    return apiFetch<{ success: boolean; learner: LearnerSummaryItem }>(`/admin/learners/${uid}`);
  },

  registerSingleLearner: async (
    payload: SingleLearnerInput
  ): Promise<{ success: boolean; learner: LearnerSummaryItem; message: string }> => {
    return apiFetch<{ success: boolean; learner: LearnerSummaryItem; message: string }>('/admin/learners', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  bulkImportLearners: async (rows: BulkLearnerRowInput[]): Promise<BulkImportResult> => {
    return apiFetch<BulkImportResult>('/admin/learners/bulk', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
  },

  triggerWhatsAppOnboarding: async (uid: string): Promise<{ success: boolean; result: WhatsAppOnboardingResult }> => {
    return apiFetch<{ success: boolean; result: WhatsAppOnboardingResult }>(`/admin/learners/${uid}/whatsapp-onboard`, {
      method: 'POST',
    });
  },

  bulkTriggerWhatsAppOnboarding: async (
    uids: string[]
  ): Promise<{ success: boolean; total: number; sentCount: number; failedCount: number; results: WhatsAppOnboardingResult[] }> => {
    return apiFetch<{
      success: boolean;
      total: number;
      sentCount: number;
      failedCount: number;
      results: WhatsAppOnboardingResult[];
    }>('/admin/learners/bulk-whatsapp-onboard', {
      method: 'POST',
      body: JSON.stringify({ uids }),
    });
  },

  updateLearner: async (
    uid: string,
    payload: import('../models/admin.types').UpdateLearnerInput
  ): Promise<{ success: boolean; learner: LearnerSummaryItem; message: string }> => {
    return apiFetch<{ success: boolean; learner: LearnerSummaryItem; message: string }>(`/admin/learners/${uid}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  setLearnerStatus: async (
    uid: string,
    status: 'ACTIVE' | 'DEACTIVATED'
  ): Promise<{ success: boolean; learner: LearnerSummaryItem; message: string }> => {
    return apiFetch<{ success: boolean; learner: LearnerSummaryItem; message: string }>(`/admin/learners/${uid}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  resetLearnerCredentials: async (
    uid: string
  ): Promise<{ success: boolean; result: import('../models/admin.types').ResetCredentialsResult; message: string }> => {
    return apiFetch<{ success: boolean; result: import('../models/admin.types').ResetCredentialsResult; message: string }>(
      `/admin/learners/${uid}/reset-credentials`,
      {
        method: 'POST',
      }
    );
  },
};
