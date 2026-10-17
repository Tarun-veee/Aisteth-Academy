import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', (req, res, next) => {
  // If user provided a Bearer token, run authMiddleware to identify UID for allDevices revocation;
  // otherwise proceed directly to cookie clearance.
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    authMiddleware(req as any, res, () => AuthController.logout(req as any, res, next));
  } else {
    AuthController.logout(req as any, res, next);
  }
});
authRouter.post('/forgot-password', AuthController.forgotPassword);
