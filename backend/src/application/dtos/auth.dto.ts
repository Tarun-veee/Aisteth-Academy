import { UserProfile } from '../../domain/models/user.model.js';
import { UserStats } from '../../domain/models/session.model.js';

export interface RegisterRequestDTO {
  username: string;
  password: string;
  displayName: string;
  designation: string;
  healthSubCentre?: string;
  district?: string; // Optional legacy parameter
  state?: string;    // Optional legacy parameter
  optionalEmail?: string;
  phoneNumber?: string;
  onboardingStatus?: string;
}

export interface LoginRequestDTO {
  identifier: string;
  password: string;
}

export interface AuthResponseDTO {
  success: boolean;
  token?: string;
  profile: UserProfile;
  stats: UserStats;
  message?: string;
  code?: string;
  requiresLogin?: boolean;
}

export interface RefreshResponseDTO {
  success: boolean;
  token: string;
  expiresIn?: number;
}

export interface UpdateProfileRequestDTO {
  displayName?: string;
  designation?: string;
  healthSubCentre?: string;
  optionalEmail?: string;
}

