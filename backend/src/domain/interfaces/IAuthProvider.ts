export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
  uid: string;
}

export interface DecodedToken {
  uid: string;
  email?: string;
  role?: string;
}

export interface IAuthProvider {
  authenticateWithPassword(credentials: AuthCredentials): Promise<AuthTokens>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  verifyIdToken(token: string): Promise<DecodedToken>;
  createUser(email: string, password: string, displayName: string): Promise<{ uid: string }>;
  deleteUser(uid: string): Promise<void>;
  revokeUserSessions(uid: string): Promise<void>;
  generatePasswordResetLink(email: string): Promise<string>;
  updateUserPassword?(uid: string, password: string): Promise<void>;
  updateUserDisabled?(uid: string, disabled: boolean): Promise<void>;
}
