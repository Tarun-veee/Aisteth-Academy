/**
 * AiSteth Academy — Cloud Functions Entry Point
 * Specification Baseline: v2.6.1-PROD-SPEC
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { RegistrationService } from './services/registrationService';

// Initialize Firebase Admin SDK singleton
if (!admin.apps.length) {
  admin.initializeApp();
}

const registrationService = new RegistrationService();

/**
 * Public Trainee Registration Callable Function
 * Endpoint: registerWithUsername
 *
 * Implements the 5-step Idempotent Reservation + Compensation Workflow.
 * Server assigns role = 'TRAINEE' and default onboarding organization.
 */
export const registerWithUsername = onCall(
  {
    cors: true,
    region: 'asia-south1', // Default GCP region for India deployment
  },
  async (request) => {
    try {
      const data = request.data;
      const result = await registrationService.registerTrainee(data);
      return result;
    } catch (err: any) {
      console.error('[registerWithUsername ERROR]:', err);

      const message = err?.message || 'An unexpected registration error occurred.';

      if (message.includes('already registered') || message.includes('already in use')) {
        throw new HttpsError('already-exists', message);
      }

      if (message.includes('required') || message.includes('must be') || message.includes('Invalid')) {
        throw new HttpsError('invalid-argument', message);
      }

      throw new HttpsError('internal', message);
    }
  }
);
