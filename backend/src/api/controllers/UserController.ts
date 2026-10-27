import { Response, NextFunction } from 'express';
import { authUseCase } from './AuthController.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { LeaderboardUseCase } from '../../application/usecases/LeaderboardUseCase.js';
import { defaultUserRepository } from '../../infrastructure/firestore/FirestoreUserRepository.js';


export const leaderboardUseCase = new LeaderboardUseCase(defaultUserRepository);

export class UserController {
  static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const data = await authUseCase.getUserProfileAndStats(uid);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      const updatedProfile = await authUseCase.updateProfile(uid, req.body);
      res.status(200).json({ success: true, profile: updatedProfile });
    } catch (err) {
      next(err);
    }
  }

  static async getLeaderboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const uid = req.user!.uid;
      let limit = 50;
      if (req.query.limit !== undefined) {
        const raw = req.query.limit;
        if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) {
          throw new Error('Invalid limit query parameter. Limit must be an integer between 10 and 100.');
        }
        const parsed = parseInt(raw.trim(), 10);
        if (parsed < 10 || parsed > 100) {
          throw new Error('Invalid limit query parameter. Limit must be between 10 and 100.');
        }
        limit = parsed;
      }
      const data = await leaderboardUseCase.execute(uid, limit);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}


