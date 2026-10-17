import { apiFetch, setAccessToken } from './client';
import { userApi } from './userApi';
import { UserProfile } from '../models/user.types';
import { UserStats } from '../models/session.types';

export interface RegisterPayload {
  username: string;
  password: string;
  displayName: string;
  designation: string;
  district: string;
  state: string;
  healthSubCentre?: string;
  optionalEmail?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface AuthApiResponse {
  success: boolean;
  token: string;
  profile: UserProfile;
  stats: UserStats;
  message?: string;
}

export interface RefreshApiResponse {
  success: boolean;
  token: string;
  expiresIn?: number;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthApiResponse> {
    const res = await apiFetch<AuthApiResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAccessToken(res.token);
    return res;
  },

  async login(payload: LoginPayload): Promise<AuthApiResponse> {
    const res = await apiFetch<AuthApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setAccessToken(res.token);
    return res;
  },

  async refresh(): Promise<RefreshApiResponse> {
    const res = await apiFetch<RefreshApiResponse>('/auth/refresh', {
      method: 'POST',
    });
    setAccessToken(res.token);
    return res;
  },

  async logout(allDevices: boolean = false): Promise<void> {
    try {
      await apiFetch(`/auth/logout?allDevices=${allDevices}`, {
        method: 'POST',
      });
    } finally {
      setAccessToken(null);
    }
  },

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string }> {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  async getMe(): Promise<{ profile: UserProfile; stats: UserStats }> {
    return userApi.getProfile();
  },

  async updateMe(payload: Partial<UserProfile>): Promise<{ success: boolean; profile: UserProfile }> {
    return userApi.updateProfile(payload);
  },
};
