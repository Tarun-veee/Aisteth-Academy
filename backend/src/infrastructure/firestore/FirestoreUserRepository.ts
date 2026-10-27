import admin from 'firebase-admin';
import { IUserRepository, RawLeaderboardEntry } from '../../domain/interfaces/IUserRepository.js';
import { UserProfileDoc, UserLearningState } from '../../domain/models/user.model.js';
import { ProgressionService } from '../../domain/rules/ProgressionService.js';
import { normalizePhoneNumber } from '../../domain/rules/phone.js';
import { adminDb } from '../config/firebaseAdmin.js';

export const RESERVATION_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

export class FirestoreUserRepository implements IUserRepository {
  async findByUid(uid: string): Promise<UserProfileDoc | null> {
    const userSnap = await adminDb.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return null;
    }
    const data = userSnap.data() as any;
    return {
      uid: data.uid || uid,
      username: data.username || '',
      syntheticEmail: data.syntheticEmail || '',
      optionalEmail: data.optionalEmail,
      displayName: data.displayName || '',
      role: data.role || 'TRAINEE',
      organizationId: data.organizationId || 'org_rbsk_national',
      designation: data.designation || '',
      healthSubCentre: data.healthSubCentre || '',
      ...(data.district ? { district: data.district } : {}),
      ...(data.state ? { state: data.state } : {}),
      trainingTimeZone: data.trainingTimeZone || 'Asia/Kolkata',
      phoneNumber: data.phoneNumber || undefined,
      onboardingStatus: data.onboardingStatus || 'NOT_INITIATED',
      whatsappOnboardedAt: data.whatsappOnboardedAt || null,
      onboardingError: data.onboardingError || null,
      learningState: {
        totalXp: data.learningState?.totalXp as any,
        currentStreak: data.learningState?.currentStreak ?? 0,
        longestStreak: data.learningState?.longestStreak ?? data.learningState?.currentStreak ?? 0,
        lastActiveDate: data.learningState?.lastActiveDate ?? null,
        completedQuestionsCount: data.learningState?.completedQuestionsCount ?? 0,
        completedSessionsCount: data.learningState?.completedSessionsCount ?? 0,
        totalCorrectAnswersCount: data.learningState?.totalCorrectAnswersCount ?? 0,
        currentLevel: data.learningState?.currentLevel ?? 1,
      },
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastActiveAt: data.lastActiveAt,
    };
  }

  async findByUsername(username: string): Promise<{ uid: string | null; status: string } | null> {
    const snap = await adminDb.doc(`usernames/${username}`).get();
    if (!snap.exists) {
      return null;
    }
    const data = snap.data();
    return {
      uid: data?.uid || null,
      status: data?.status || 'UNKNOWN'
    };
  }

  async reserveUsername(username: string, reservationId: string): Promise<boolean> {
    const usernameRef = adminDb.doc(`usernames/${username}`);

    return adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(usernameRef);

      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        if (data?.status === 'ACTIVE') {
          throw new Error(`Username '@${username}' is already registered.`);
        }
        if (data?.status === 'RESERVED') {
          const reservedAt = data?.reservedAt as admin.firestore.Timestamp | undefined;
          const reservedAtMs = reservedAt ? reservedAt.toMillis() : Date.now();
          const elapsed = Date.now() - reservedAtMs;
          if (elapsed < RESERVATION_EXPIRATION_MS) {
            throw new Error(`Username '@${username}' registration is currently in progress. Please retry in a few moments.`);
          }
        }
      }

      transaction.set(usernameRef, {
        username,
        uid: null,
        status: 'RESERVED',
        reservationId,
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return true;
    });
  }

  async releaseUsername(username: string, reservationId: string, ownerUid?: string): Promise<void> {
    const usernameRef = adminDb.doc(`usernames/${username}`);
    await adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(usernameRef);
      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        if (data?.reservationId === reservationId) {
          if (data?.status === 'RESERVED' || (ownerUid && data?.uid === ownerUid)) {
            transaction.delete(usernameRef);
          }
        }
      }
    });
  }

  async activateUsername(username: string, uid: string, reservationId?: string): Promise<void> {
    const usernameRef = adminDb.doc(`usernames/${username}`);
    await adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(usernameRef);
      if (!docSnapshot.exists) {
        throw new Error(`Username reservation for '@${username}' was not found.`);
      }
      const data = docSnapshot.data();

      if (data?.status === 'ACTIVE') {
        if (data?.uid === uid) {
          if (reservationId && data?.reservationId && data?.reservationId !== reservationId) {
            throw new Error(`Username '@${username}' is active under a different reservation.`);
          }
          return;
        }
        throw new Error(`Username '@${username}' is already active for another learner.`);
      }

      if (data?.status !== 'RESERVED') {
        throw new Error(`Username '@${username}' is not in RESERVED status (found: ${data?.status}).`);
      }

      if (!reservationId || data?.reservationId !== reservationId) {
        throw new Error(`Username reservation ownership mismatch for '@${username}'. A valid matching reservation ID is required.`);
      }

      const reservedAt = data?.reservedAt as admin.firestore.Timestamp | undefined;
      const reservedAtMs = (reservedAt && typeof reservedAt.toMillis === 'function') ? reservedAt.toMillis() : 0;
      const elapsed = reservedAtMs > 0 ? Date.now() - reservedAtMs : RESERVATION_EXPIRATION_MS;
      if (elapsed >= RESERVATION_EXPIRATION_MS) {
        throw new Error(`Username reservation for '@${username}' has expired.`);
      }

      transaction.set(usernameRef, {
        username,
        uid,
        status: 'ACTIVE',
        reservationId: reservationId || data?.reservationId || '',
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }

  async deleteUserProfile(uid: string): Promise<void> {
    const userRef = adminDb.doc(`users/${uid}`);
    await userRef.delete();
  }

  async createUserProfile(profile: UserProfileDoc): Promise<void> {
    const userRef = adminDb.doc(`users/${profile.uid}`);
    await userRef.set({
      uid: profile.uid,
      username: profile.username,
      syntheticEmail: profile.syntheticEmail,
      optionalEmail: profile.optionalEmail || '',
      displayName: profile.displayName,
      role: profile.role,
      organizationId: profile.organizationId,
      designation: profile.designation,
      healthSubCentre: profile.healthSubCentre,
      ...(profile.district ? { district: profile.district } : {}),
      ...(profile.state ? { state: profile.state } : {}),
      trainingTimeZone: profile.trainingTimeZone,
      phoneNumber: profile.phoneNumber || null,
      onboardingStatus: profile.onboardingStatus || 'NOT_INITIATED',
      whatsappOnboardedAt: profile.whatsappOnboardedAt || null,
      onboardingError: profile.onboardingError || null,
      learningState: profile.learningState,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async updateUserProfile(uid: string, updates: Partial<UserProfileDoc>): Promise<void> {
    const userRef = adminDb.doc(`users/${uid}`);
    const dataToUpdate: Record<string, any> = {
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Ensure immutable, server-controlled and identity fields are never modified via profile update
    const PROTECTED_FIELDS = [
      'uid',
      'username',
      'role',
      'roles',
      'organizationId',
      'syntheticEmail',
      'trainingTimeZone',
      'createdAt',
      'learningState',
      'lastActiveAt',
      'totalXp',
      'xp',
      'level',
      'currentLevel',
      'streak',
      'currentStreak',
    ];
    for (const field of PROTECTED_FIELDS) {
      delete dataToUpdate[field];
    }

    await userRef.update(dataToUpdate);
  }

  async updateLearningState(uid: string, updates: Partial<UserLearningState>): Promise<void> {
    const userRef = adminDb.doc(`users/${uid}`);
    const updateObj: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    for (const [key, value] of Object.entries(updates)) {
      updateObj[`learningState.${key}`] = value;
    }
    await userRef.update(updateObj);
  }

  async getLeaderboardEntries(limit: number): Promise<RawLeaderboardEntry[]> {
    const snapshot = await adminDb
      .collection('users')
      .where('role', '==', 'TRAINEE')
      .orderBy('learningState.totalXp', 'desc')
      .limit(limit)
      .get();

    const validEntries: RawLeaderboardEntry[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const rawXp = data?.learningState?.totalXp;
      if (!ProgressionService.isValidXp(rawXp)) {
        continue;
      }
      validEntries.push({
        uid: doc.id,
        username: data?.username || '',
        displayName: data?.displayName || '',
        totalXp: rawXp,
        createdAt: data?.createdAt || null,
      });
    }

    return validEntries;
  }

  async countEligibleParticipants(): Promise<number> {
    const snapshot = await adminDb
      .collection('users')
      .where('role', '==', 'TRAINEE')
      .where('learningState.totalXp', '>=', 0)
      .count()
      .get();

    return snapshot.data().count || 0;
  }

  async countUsersWithHigherXp(xp: number): Promise<number> {
    if (!ProgressionService.isValidXp(xp)) {
      return 0;
    }
    const snapshot = await adminDb
      .collection('users')
      .where('role', '==', 'TRAINEE')
      .where('learningState.totalXp', '>', xp)
      .count()
      .get();

    return snapshot.data().count || 0;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<{ uid: string | null; status: string } | null> {
    if (!phoneNumber || typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      return null;
    }

    const norm = normalizePhoneNumber(phoneNumber);
    const canonicalPhone = norm.valid ? norm.normalized : phoneNumber.trim();

    const phoneRef = adminDb.doc(`phone_numbers/${canonicalPhone}`);
    const snap = await phoneRef.get();
    if (snap.exists) {
      const data = snap.data();
      return {
        uid: data?.uid || null,
        status: data?.status || 'UNKNOWN'
      };
    }

    // Backward-compatible fallback for users created before phone_numbers collection
    // Supports: canonical E.164 (+91...), raw 10-digit, leading 0, and 91 prefix
    const candidates = new Set<string>();
    candidates.add(canonicalPhone);
    candidates.add(phoneNumber.trim());

    if (canonicalPhone.startsWith('+91') && canonicalPhone.length === 13) {
      const raw10 = canonicalPhone.slice(3);
      candidates.add(raw10);
      candidates.add(`0${raw10}`);
      candidates.add(`91${raw10}`);
    } else if (/^\d{10}$/.test(phoneNumber.trim())) {
      candidates.add(`+91${phoneNumber.trim()}`);
      candidates.add(`0${phoneNumber.trim()}`);
      candidates.add(`91${phoneNumber.trim()}`);
    }

    const candidateArr = Array.from(candidates).filter(Boolean);
    if (candidateArr.length > 0) {
      const userSnap = await adminDb
        .collection('users')
        .where('phoneNumber', 'in', candidateArr.slice(0, 10))
        .limit(1)
        .get();

      if (!userSnap.empty) {
        const doc = userSnap.docs[0];
        return {
          uid: doc.id,
          status: 'ACTIVE'
        };
      }
    }

    return null;
  }

  async findProfileByPhoneNumber(phoneNumber: string): Promise<UserProfileDoc | null> {
    const phoneRecord = await this.findByPhoneNumber(phoneNumber);
    if (!phoneRecord || !phoneRecord.uid) {
      return null;
    }
    return this.findByUid(phoneRecord.uid);
  }

  async reservePhoneNumber(phoneNumber: string, reservationId: string): Promise<boolean> {
    const phoneRef = adminDb.doc(`phone_numbers/${phoneNumber}`);

    return adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(phoneRef);

      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        if (data?.status === 'ACTIVE') {
          throw new Error(`Learner with phone number '${phoneNumber}' is already registered.`);
        }
        if (data?.status === 'RESERVED') {
          const reservedAt = data?.reservedAt as admin.firestore.Timestamp | undefined;
          const reservedAtMs = (reservedAt && typeof reservedAt.toMillis === 'function') ? reservedAt.toMillis() : 0;
          const elapsed = reservedAtMs > 0 ? Date.now() - reservedAtMs : RESERVATION_EXPIRATION_MS;
          if (elapsed < RESERVATION_EXPIRATION_MS) {
            throw new Error(`Registration for phone number '${phoneNumber}' is currently in progress. Please retry in a few moments.`);
          }
        }
      }

      transaction.set(phoneRef, {
        phoneNumber,
        uid: null,
        status: 'RESERVED',
        reservationId,
        reservedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return true;
    });
  }

  async releasePhoneNumber(phoneNumber: string, reservationId: string, ownerUid?: string): Promise<void> {
    const phoneRef = adminDb.doc(`phone_numbers/${phoneNumber}`);
    await adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(phoneRef);
      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        if (data?.reservationId === reservationId) {
          if (data?.status === 'RESERVED' || (ownerUid && data?.uid === ownerUid)) {
            transaction.delete(phoneRef);
          }
        }
      }
    });
  }

  async activatePhoneNumber(phoneNumber: string, uid: string, reservationId?: string): Promise<void> {
    const phoneRef = adminDb.doc(`phone_numbers/${phoneNumber}`);

    await adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(phoneRef);

      if (!docSnapshot.exists) {
        throw new Error(`Phone reservation for '${phoneNumber}' was not found.`);
      }

      const data = docSnapshot.data();

      if (data?.status === 'ACTIVE') {
        if (data?.uid === uid) {
          if (reservationId && data?.reservationId && data?.reservationId !== reservationId) {
            throw new Error(`Phone number '${phoneNumber}' is active under a different reservation.`);
          }
          return;
        }
        throw new Error(`Phone number '${phoneNumber}' is already active for another learner.`);
      }

      if (data?.status !== 'RESERVED') {
        throw new Error(`Phone number '${phoneNumber}' is not in RESERVED status (found: ${data?.status}).`);
      }

      if (!reservationId || data?.reservationId !== reservationId) {
        throw new Error(`Phone reservation ownership mismatch for '${phoneNumber}'. A valid matching reservation ID is required.`);
      }

      const reservedAt = data?.reservedAt as admin.firestore.Timestamp | undefined;
      const reservedAtMs = (reservedAt && typeof reservedAt.toMillis === 'function') ? reservedAt.toMillis() : 0;
      const elapsed = reservedAtMs > 0 ? Date.now() - reservedAtMs : RESERVATION_EXPIRATION_MS;
      if (elapsed >= RESERVATION_EXPIRATION_MS) {
        throw new Error(`Phone reservation for '${phoneNumber}' has expired.`);
      }

      transaction.set(phoneRef, {
        phoneNumber,
        uid,
        status: 'ACTIVE',
        reservationId: reservationId || data?.reservationId || '',
        activatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
  }
}

export const defaultUserRepository = new FirestoreUserRepository();
