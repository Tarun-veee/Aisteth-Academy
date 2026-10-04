/**
 * AiSteth Academy — Username & Registration Validation Utilities
 * Specification Baseline: v2.6.1-PROD-SPEC
 */

import { Designation, RegisterWithUsernameRequest } from '../types/auth.types';

export const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;

const VALID_DESIGNATIONS: Designation[] = ['ASHA', 'ANM', 'CHO', 'RBSK_MO', 'SUPERVISOR', 'OTHER'];

/**
 * Normalizes and strictly validates a raw username.
 * Rules:
 * - Lowercased and trimmed.
 * - Length: 3 to 30 characters.
 * - Allowed characters: lowercase alphanumeric, dots, underscores, hyphens.
 * - Cannot start or end with special characters.
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

/**
 * Validates and sanitizes public trainee registration payload.
 * Enforces that public clients CANNOT supply or alter role or organizationId.
 */
export function validateTraineeRegistrationInput(payload: unknown): RegisterWithUsernameRequest {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid request payload: Expected JSON object.');
  }

  const raw = payload as Record<string, unknown>;

  // 1. Username
  const username = normalizeUsername(String(raw.username || ''));

  // 2. Password
  const pwdValidation = validatePassword(String(raw.password || ''));
  if (!pwdValidation.valid) {
    throw new Error(pwdValidation.error);
  }
  const password = String(raw.password);

  // 3. Display Name
  const displayName = String(raw.displayName || '').trim();
  if (displayName.length < 2 || displayName.length > 80) {
    throw new Error('Full Name (displayName) must be between 2 and 80 characters.');
  }

  // 4. Designation
  const rawDesignation = String(raw.designation || '').trim().toUpperCase() as Designation;
  const designation = VALID_DESIGNATIONS.includes(rawDesignation) ? rawDesignation : 'ASHA';

  // 5. State & District
  const state = String(raw.state || '').trim();
  if (!state) {
    throw new Error('State selection is required.');
  }

  const district = String(raw.district || '').trim();
  if (!district) {
    throw new Error('District selection is required.');
  }

  // 6. Optional Health Sub-Centre
  const healthSubCentre = raw.healthSubCentre ? String(raw.healthSubCentre).trim() : '';

  // 7. Optional Contact Email
  let optionalEmail = '';
  if (raw.optionalEmail && typeof raw.optionalEmail === 'string') {
    const trimmedEmail = raw.optionalEmail.trim();
    if (trimmedEmail) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmedEmail)) {
        throw new Error('Please enter a valid optional email address.');
      }
      optionalEmail = trimmedEmail;
    }
  }

  return {
    username,
    password,
    displayName,
    designation,
    district,
    state,
    healthSubCentre,
    optionalEmail,
  };
}
