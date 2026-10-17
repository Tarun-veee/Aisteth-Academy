import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[API Error]:', err?.message || err);

  const message = err?.message || 'An unexpected server error occurred.';
  let statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;

  if (statusCode === 500) {
    if (
      message.includes('required') ||
      message.includes('must be') ||
      message.includes('Please enter') ||
      message.includes('Invalid') ||
      message.includes('cannot') ||
      message.includes('MALFORMED_IDEMPOTENCY_KEY')
    ) {
      statusCode = 400;
    } else if (
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('USER_NOT_FOUND') ||
      message.includes('SESSION_NOT_FOUND')
    ) {
      statusCode = 404;
    } else if (
      message.includes('already registered') ||
      message.includes('in progress') ||
      message.includes('already exists') ||
      message.includes('already completed') ||
      message.includes('mismatch') ||
      message.includes('CONFLICT') ||
      message.includes('CORRUPTED')
    ) {
      statusCode = 409;
    } else if (
      message.includes('Invalid username or password') ||
      message.includes('disabled') ||
      message.includes('expired')
    ) {
      statusCode = 401;
    } else if (message.includes('FORBIDDEN') || message.includes('IDENTITY_MISMATCH')) {
      statusCode = 403;
    }
  }

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
