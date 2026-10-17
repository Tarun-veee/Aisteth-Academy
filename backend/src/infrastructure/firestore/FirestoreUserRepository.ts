import admin from 'firebase-admin';
import { IUserRepository, RawLeaderboardEntry } from '../../domain/interfaces/IUserRepository.js';
import { UserProfileDoc, UserLearningState } from '../../domain/models/user.model.js';
import { ProgressionService } from '../../domain/rules/ProgressionService.js';
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
      district: data.district || '',
      state: data.state || '',
      trainingTimeZone: data.trainingTimeZone || 'Asia/Kolkata',
      learningState: {
        totalXp: data.learningState?.totalXp as any,
        currentStreak: data.learningState?.currentStreak ?? 0,
        longestStreak: data.learningState?.longestStreak ?? data.learningState?.currentStreak ?? 0,
        lastActiveDate: data.learningState?.lastActiveDate ?? null,
        completedQuestionsCount: data.learningState?.completedQuestionsCount ?? 0,
        completedSessionsCount: data.learningState?.completedSessionsCount ?? 0,
        totalCorrectAnswersCount: data.learningState?.totalCorrectAnswersCount ?? 0,
        currentLevel: data.learningState?.currentLevel ?? 1,
        streakShieldActive: data.learningState?.streakShieldActive ?? false,
        streakShieldConsumed: data.learningState?.streakShieldConsumed ?? false,
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

  async releaseUsername(username: string, reservationId: string): Promise<void> {
    const usernameRef = adminDb.doc(`usernames/${username}`);
    await adminDb.runTransaction(async (transaction) => {
      const docSnapshot = await transaction.get(usernameRef);
      if (docSnapshot.exists) {
        const data = docSnapshot.data();
        if (data?.reservationId === reservationId && data?.status === 'RESERVED') {
          transaction.delete(usernameRef);
        }
      }
    });
  }

  async activateUsername(username: string, uid: string): Promise<void> {
    const usernameRef = adminDb.doc(`usernames/${username}`);
    await usernameRef.set({
      username,
      uid,
      status: 'ACTIVE',
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
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
      district: profile.district,
      state: profile.state,
      trainingTimeZone: profile.trainingTimeZone,
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
}

export const defaultUserRepository = new FirestoreUserRepository();
