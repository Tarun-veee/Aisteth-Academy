import { UserProfile } from './user.types';

export type AuthStatus = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';

export type AuthView = 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD';

export interface AuthSession {
  userId: string;
  token: string;
  authenticatedAt: string;
  emailOrPhone: string;
}

export interface SignInCredentials {
  identifier: string; // email or phone
  password: string;
}

export interface SignUpPayload {
  name: string;
  role: 'ASHA_WORKER' | 'ANGANWADI_WORKER' | 'HEALTH_VOLUNTEER';
  healthSubCentre: string;
  district?: string; // Optional legacy parameter
  state?: string;    // Optional legacy parameter
  identifier: string; // email or phone
  password: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  profile?: UserProfile;
  requiresLogin?: boolean;
}
