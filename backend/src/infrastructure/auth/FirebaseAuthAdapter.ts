import {
  IAuthProvider,
  AuthCredentials,
  AuthTokens,
  DecodedToken
} from '../../domain/interfaces/IAuthProvider.js';
import { adminAuth } from '../config/firebaseAdmin.js';
import { ENV } from '../config/env.js';

export class FirebaseAuthAdapter implements IAuthProvider {
  async authenticateWithPassword(credentials: AuthCredentials): Promise<AuthTokens> {
    const { email, password } = credentials;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${ENV.FIREBASE_WEB_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || 'Authentication failed.';
      if (errorMsg === 'EMAIL_NOT_FOUND' || errorMsg === 'INVALID_PASSWORD' || errorMsg === 'INVALID_LOGIN_CREDENTIALS') {
        throw new Error('Invalid username or password.');
      }
      if (errorMsg === 'USER_DISABLED') {
        throw new Error('This account has been disabled.');
      }
      if (errorMsg.includes('TOO_MANY_ATTEMPTS')) {
        throw new Error('Too many failed attempts. Please try again later.');
      }
      throw new Error(`Authentication error: ${errorMsg}`);
    }

    return {
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: Number(data.expiresIn || 3600),
      uid: data.localId
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const url = `https://securetoken.googleapis.com/v1/token?key=${ENV.FIREBASE_WEB_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error('Failed to refresh authentication token. Session may have expired.');
    }

    return {
      token: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: Number(data.expires_in || 3600),
      uid: data.user_id
    };
  }

  async verifyIdToken(token: string): Promise<DecodedToken> {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        role: decoded.role as string | undefined
      };
    } catch (err: any) {
      throw new Error(`Invalid or expired token: ${err?.message || 'Token verification failed'}`);
    }
  }

  async createUser(email: string, password: string, displayName: string): Promise<{ uid: string }> {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName
    });
    return { uid: userRecord.uid };
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      console.warn(`[FirebaseAuthAdapter] Failed to delete user ${uid}:`, err);
    }
  }

  async revokeUserSessions(uid: string): Promise<void> {
    await adminAuth.revokeRefreshTokens(uid);
  }

  async generatePasswordResetLink(email: string): Promise<string> {
    return adminAuth.generatePasswordResetLink(email);
  }

  async updateUserPassword(uid: string, password: string): Promise<void> {
    await adminAuth.updateUser(uid, { password });
  }

  async updateUserDisabled(uid: string, disabled: boolean): Promise<void> {
    await adminAuth.updateUser(uid, { disabled });
  }
}

export const defaultAuthProvider = new FirebaseAuthAdapter();
