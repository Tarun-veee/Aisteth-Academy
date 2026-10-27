import { apiFetch } from './client';
import { UserProfile } from '../models/user.types';
import { UserStats } from '../models/session.types';

export interface GetUserProfileResponse {
  profile: UserProfile;
  stats: UserStats;
}

export interface UpdateUserProfilePayload {
  name?: string;
  displayName?: string;
  role?: string;
  designation?: string;
  healthSubCentre?: string;
  centerName?: string;
  email?: string;
  optionalEmail?: string;
}

export interface UpdateUserProfileResponse {
  success: boolean;
  profile: UserProfile;
}

/**
 * Backend-Authoritative User Profile API Client
 * Targets authenticated endpoints:
 *   GET   /api/v1/users/me
 *   PATCH /api/v1/users/me
 */
export const userApi = {
  /**
   * Fetch authenticated user's authoritative profile and current stats.
   */
  async getProfile(): Promise<GetUserProfileResponse> {
    return apiFetch<GetUserProfileResponse>('/users/me', {
      method: 'GET',
    });
  },

  /**
   * Update allow-listed profile demographic fields.
   * Maps client field names to backend UpdateProfileRequestDTO schema:
   * (displayName, designation, district, state, healthSubCentre, optionalEmail)
   */
  async updateProfile(payload: UpdateUserProfilePayload): Promise<UpdateUserProfileResponse> {
    const body: Record<string, string> = {};

    const resolvedName = payload.displayName !== undefined ? payload.displayName : payload.name;
    if (resolvedName !== undefined) {
      body.displayName = resolvedName.trim();
    }

    const resolvedRole = payload.designation !== undefined ? payload.designation : payload.role;
    if (resolvedRole !== undefined) {
      body.designation = resolvedRole.trim();
    }

    const resolvedCenter = payload.healthSubCentre !== undefined ? payload.healthSubCentre : payload.centerName;
    if (resolvedCenter !== undefined) {
      body.healthSubCentre = resolvedCenter.trim();
    }

    const resolvedEmail = payload.optionalEmail !== undefined ? payload.optionalEmail : payload.email;
    if (resolvedEmail !== undefined) {
      body.optionalEmail = resolvedEmail.trim();
    }

    return apiFetch<UpdateUserProfileResponse>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};

