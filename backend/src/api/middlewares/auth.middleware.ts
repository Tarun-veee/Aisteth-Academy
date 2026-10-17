import { Request, Response, NextFunction } from 'express';
import { defaultAuthProvider } from '../../infrastructure/auth/FirebaseAuthAdapter.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. No authorization token provided.'
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Invalid authorization header format.'
    });
    return;
  }

  try {
    const decoded = await defaultAuthProvider.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token. Please refresh your session.',
      code: 'TOKEN_EXPIRED'
    });
  }
}
