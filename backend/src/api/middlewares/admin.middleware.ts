import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';
import { defaultUserRepository } from '../../infrastructure/firestore/FirestoreUserRepository.js';

export async function requireAdminRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.user.uid) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. No authorization token provided.',
      code: 'UNAUTHENTICATED'
    });
    return;
  }

  // 1. Check custom claim on decoded token
  const tokenRole = req.user.role;
  if (tokenRole === 'PLATFORM_ADMIN' || tokenRole === 'SUPERVISOR') {
    return next();
  }

  // 2. Authoritative check in Firestore user profile
  try {
    const userDoc = await defaultUserRepository.findByUid(req.user.uid);
    if (userDoc && (userDoc.role === 'PLATFORM_ADMIN' || userDoc.role === 'SUPERVISOR')) {
      req.user.role = userDoc.role;
      return next();
    }
  } catch (err) {
    console.error('[requireAdminRole] Error checking user profile role:', err);
  }

  res.status(403).json({
    success: false,
    error: 'Access denied. Administrator privileges are required to access this resource.',
    code: 'FORBIDDEN_NOT_ADMIN'
  });
}
