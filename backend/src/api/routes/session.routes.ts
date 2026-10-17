import { Router } from 'express';
import { SessionController } from '../controllers/SessionController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const sessionRouter = Router();

sessionRouter.use(authMiddleware as any);

sessionRouter.get('/today', SessionController.getTodaySession as any);
sessionRouter.post('/today/attempts', SessionController.recordAttempt as any);
sessionRouter.post('/today/finalize', SessionController.finalizeSession as any);
