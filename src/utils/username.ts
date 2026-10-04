/**
 * AiSteth Academy — Client Username & Registration Validation Utilities
 * Specification: v2.7.0-SPARK-SPEC
 */

export const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

export type Designation = 'ASHA' | 'ANM' | 'CHO' | 'RBSK_MO' | 'SUPERVISOR' | 'OTHER';

/**
 * Normalizes and strictly validates a raw username.
 */
export function normalizeUsername(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Username is required and must be a valid string.');
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized.length < 3 || normalized.length > 30) {
    throw new Error('Username must be between 3 and 30 characters long.');
  }

  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error('Username may only contain letters, numbers, dots, hyphens, and underscores.');
  }

  if (/^[._-]|[._-]$/.test(normalized)) {
    throw new Error('Username cannot begin or end with a special character (dot, underscore, hyphen).');
  }

  if (/[._-]{2,}/.test(normalized)) {
    throw new Error('Username cannot contain consecutive special characters.');
  }

  return normalized;
}

/**
 * Generates the internal synthetic Firebase email for a normalized username.
 */
export function generateSyntheticEmail(normalizedUsername: string): string {
  return `${normalizedUsername}@trainee.aisteth.internal`;
}

/**
 * Validates password strength for registration.
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }

  return { valid: true };
}
