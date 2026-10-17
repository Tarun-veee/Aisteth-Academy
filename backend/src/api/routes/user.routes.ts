import { Router } from 'express';
import { UserController } from '../controllers/UserController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const userRouter = Router();

userRouter.use(authMiddleware as any);

userRouter.get('/me', UserController.getMe as any);
userRouter.patch('/me', UserController.updateMe as any);
userRouter.get('/leaderboard', UserController.getLeaderboard as any);

