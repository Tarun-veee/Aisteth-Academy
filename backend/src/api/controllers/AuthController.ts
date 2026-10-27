import { Request, Response, NextFunction } from 'express';
import { AuthUseCase, RegistrationAuthenticationError } from '../../application/usecases/AuthUseCase.js';
import { defaultUserRepository } from '../../infrastructure/firestore/FirestoreUserRepository.js';
import { defaultAuthProvider } from '../../infrastructure/auth/FirebaseAuthAdapter.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export const authUseCase = new AuthUseCase(defaultUserRepository, defaultAuthProvider);

export const REFRESH_COOKIE_NAME = 'refreshToken';

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authUseCase.register(req.body);
      const { refreshToken, ...responsePayload } = result;

      if (refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
      }
      res.status(201).json(responsePayload);
    } catch (err: any) {
      if (err instanceof RegistrationAuthenticationError) {
        res.status(201).json({
          success: false,
          error: err.message,
          code: err.code,
          requiresLogin: true,
          profile: err.profile,
          stats: err.stats,
        });
        return;
      }
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authUseCase.login(req.body);
      const { refreshToken, ...responsePayload } = result;

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: 'No active session found. Please sign in.',
          code: 'NO_REFRESH_COOKIE'
        });
        return;
      }

      const result = await authUseCase.refresh(refreshToken);
      const { refreshToken: newRefreshToken, ...responsePayload } = result;

      res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json(responsePayload);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      next(err);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const allDevices = req.query.allDevices === 'true';
      if (allDevices && req.user?.uid) {
        await authUseCase.logout(req.user.uid, true);
      }

      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
      res.status(200).json({
        success: true,
        message: allDevices
          ? 'Logged out from all devices.'
          : 'Logged out successfully from this device.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier } = req.body;
      const link = await authUseCase.forgotPassword(identifier);
      res.status(200).json({
        success: true,
        message: 'Password reset instructions have been dispatched.',
        resetLink: process.env.NODE_ENV !== 'production' ? link : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
}
