/**
 * AiSteth Academy — Server-Authoritative Registration Service
 * Specification Baseline: v2.6.1-PROD-SPEC
 * Pattern: Idempotent 5-Step Registration Workflow with Compensating Cleanup & Reservation Ownership
 */

import * as admin from 'firebase-admin';
import {
  RegisterWithUsernameRequest,
  RegisterWithUsernameResponse,
  UserProfileDoc,
  UsernameReservationDoc
} from '../types/auth.types';
import {
  generateSyntheticEmail,
  validateTraineeRegistrationInput
} from '../utils/username';

export const RESERVATION_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export function generateReservationId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export class RegistrationService {
  private db: admin.firestore.Firestore;
  private auth: admin.auth.Auth;

  constructor(db?: admin.firestore.Firestore, auth?: admin.auth.Auth) {
    this.db = db || admin.firestore();
    this.auth = auth || admin.auth();
  }

  /**
   * Executes the Idempotent 5-Step Registration Workflow with Compensating Cleanup.
   *
   * 1. Validate & Sanitize Input (Server forces role = TRAINEE and default org).
   * 2. Reserve /usernames/{normalizedUsername} in Firestore transaction with unique reservationId.
   * 3. Create Firebase Auth account with synthetic email and custom claims.
   * 4. Finalize reservation (status = ACTIVE) in Firestore, verifying reservation ownership.
   * 5. Provision master user profile at /users/{uid}.
   *
   * Compensating Cleanup: If any step after reservation fails, compensation cleans up the Auth account and releases the reservation ONLY IF the reservationId matches current ownership.
   */
  async registerTrainee(
    rawPayload: unknown,
    defaultOrgId: string = 'org_rbsk_national'
  ): Promise<RegisterWithUsernameResponse> {
    // Step 1: Validate and sanitize request payload
    const payload: RegisterWithUsernameRequest = validateTraineeRegistrationInput(rawPayload);
    const { username, password, displayName } = payload;
    const syntheticEmail = generateSyntheticEmail(username);
    const operationReservationId = generateReservationId();

    const usernameRef = this.db.doc(`usernames/${username}`);
    let reservationAcquired = false;
    let createdAuthUid: string | null = null;

    try {
      // Step 2: Atomic username reservation in Firestore with ownership token
      await this.db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(usernameRef);

        if (docSnapshot.exists) {
          const data = docSnapshot.data() as UsernameReservationDoc;

          if (data.status === 'ACTIVE') {
            throw new Error(`Username '@${username}' is already registered.`);
          }

          if (data.status === 'RESERVED') {
            const reservedAt = data.reservedAt as admin.firestore.Timestamp | undefined;
            const reservedAtMs = reservedAt ? reservedAt.toMillis() : Date.now();
            const elapsed = Date.now() - reservedAtMs;

            if (elapsed < RESERVATION_EXPIRATION_MS) {
              throw new Error(`Username '@${username}' registration is currently in progress. Please retry in a few moments.`);
            }
            // Stale reservation can be reclaimed with a new reservationId
          }
        }

        const reservationData: UsernameReservationDoc = {
          username,
          uid: null,
          status: 'RESERVED',
          reservationId: operationReservationId,
          reservedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.set(usernameRef, reservationData);
      });

      reservationAcquired = true;

      // Step 3: Create Firebase Authentication account
      const userRecord = await this.auth.createUser({
        email: syntheticEmail,
        password: password,
        displayName: displayName,
      });

      createdAuthUid = userRecord.uid;

      // Set custom claims for role-based security enforcement
      await this.auth.setCustomUserClaims(createdAuthUid, {
        role: 'TRAINEE',
        organizationId: defaultOrgId,
      });

      // Step 4 & 5: Finalize reservation with ownership check and provision master user profile
      await this.db.runTransaction(async (transaction) => {
        const docSnapshot = await transaction.get(usernameRef);

        if (!docSnapshot.exists) {
          throw new Error(`Username reservation for '@${username}' was lost before finalization.`);
        }

        const data = docSnapshot.data() as UsernameReservationDoc;

        // Verify that this transaction owns the reservation token
        if (data.reservationId !== operationReservationId) {
          throw new Error(`Username reservation ownership mismatch for '@${username}'. Registration aborted.`);
        }

        const userProfileRef = this.db.doc(`users/${createdAuthUid}`);

        const userProfileData: UserProfileDoc = {
          uid: createdAuthUid!,
          username: username,
          syntheticEmail: syntheticEmail,
          optionalEmail: payload.optionalEmail || '',
          displayName: displayName,
          role: 'TRAINEE', // Strictly server-authoritative
          organizationId: defaultOrgId, // Strictly server-authoritative
          designation: payload.designation,
          healthSubCentre: payload.healthSubCentre || '',
          ...(payload.district ? { district: payload.district } : {}),
          ...(payload.state ? { state: payload.state } : {}),
          trainingTimeZone: 'Asia/Kolkata', // India standard timezone
          learningState: {
            totalXp: 0,
            currentLevel: 1,
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: null,
            completedSessionsCount: 0,
            completedQuestionsCount: 0,
            totalCorrectAnswersCount: 0,
            streakShieldActive: false,
            streakShieldConsumed: false,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActiveAt: null,
        };

        // Finalize username document
        transaction.update(usernameRef, {
          status: 'ACTIVE',
          uid: createdAuthUid,
          activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create master user profile document
        transaction.set(userProfileRef, userProfileData);
      });

      return {
        success: true,
        uid: createdAuthUid,
        username: username,
        syntheticEmail: syntheticEmail,
        displayName: displayName,
        role: 'TRAINEE',
        organizationId: defaultOrgId,
        message: 'Trainee registration completed successfully.',
      };
    } catch (err: any) {
      // Step 6: Compensating Cleanup on downstream failure
      if (createdAuthUid) {
        try {
          await this.auth.deleteUser(createdAuthUid);
        } catch (compensationAuthErr) {
          console.error(`[COMPENSATION_FAILED] Failed to delete orphaned Auth user: ${createdAuthUid}`, compensationAuthErr);
        }
      }

      if (reservationAcquired) {
        try {
          // Verify reservationId ownership before releasing to prevent deleting newer reservations
          await this.db.runTransaction(async (transaction) => {
            const docSnapshot = await transaction.get(usernameRef);
            if (docSnapshot.exists) {
              const data = docSnapshot.data() as UsernameReservationDoc;
              if (data.reservationId === operationReservationId && data.status === 'RESERVED') {
                transaction.delete(usernameRef);
              }
            }
          });
        } catch (compensationDbErr) {
          console.error(`[COMPENSATION_FAILED] Failed to release username reservation: ${username}`, compensationDbErr);
        }
      }

      throw err;
    }
  }
}
