/**
 * AiSteth Academy — Phone Identity & Normalization Rules
 * Primary identity for learners in RBSK WhatsApp Learning Engine
 */

export interface PhoneNormalizationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

/**
 * Normalizes an Indian or international phone number to canonical E.164 format.
 * Examples:
 *   "9876543210"    -> "+919876543210"
 *   "09876543210"   -> "+919876543210"
 *   "919876543210"  -> "+919876543210"
 *   "+919876543210" -> "+919876543210"
 */
export function normalizePhoneNumber(phone: string): PhoneNormalizationResult {
  if (!phone || typeof phone !== 'string') {
    return {
      valid: false,
      normalized: '',
      error: 'Phone number is required.',
    };
  }

  // Remove whitespace, dashes, parentheses, dots
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Case 1: Already has country code +91 with valid 10-digit mobile
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }

  // Case 2: Starts with 91 without plus (12 digits)
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: `+${cleaned}` };
  }

  // Case 2b: Starts with leading 0 (11 digits: 0 followed by 10-digit mobile)
  if (/^0[6-9]\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: `+91${cleaned.slice(1)}` };
  }

  // Case 3: 10-digit Indian standard mobile number starting with 6, 7, 8, or 9
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return { valid: true, normalized: `+91${cleaned}` };
  }

  // Case 4: General E.164 international standard (+ followed by 10 to 15 digits)
  if (/^\+[1-9]\d{9,14}$/.test(cleaned)) {
    return { valid: true, normalized: cleaned };
  }

  return {
    valid: false,
    normalized: '',
    error: 'Invalid phone number format. Please provide a valid 10-digit mobile number (e.g., 9876543210).',
  };
}
