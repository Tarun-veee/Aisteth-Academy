import { UserProfile } from '../../domain/models/user.model.js';
import { UserStats } from '../../domain/models/session.model.js';

export interface RegisterRequestDTO {
  username: string;
  password: string;
  displayName: string;
  designation: string;
  district: string;
  state: string;
  healthSubCentre?: string;
  optionalEmail?: string;
}

export interface LoginRequestDTO {
  identifier: string;
  password: string;
}

export interface AuthResponseDTO {
  success: boolean;
  token: string;
  profile: UserProfile;
  stats: UserStats;
  message?: string;
}

export interface RefreshResponseDTO {
  success: boolean;
  token: string;
  expiresIn?: number;
}

export interface UpdateProfileRequestDTO {
  displayName?: string;
  designation?: string;
  district?: string;
  state?: string;
  healthSubCentre?: string;
  optionalEmail?: string;
}

