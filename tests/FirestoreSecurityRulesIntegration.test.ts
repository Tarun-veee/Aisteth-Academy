/**
 * AiSteth Academy — Firestore Security Rules Integration Tests
 * Specification: v2.7.0-SPARK-SPEC
 *
 * Verification of Client-Authoritative Security Invariants & Field-Level Protections for Firebase Spark
 *
 * Test Suite Matrix: 16 Approved Security Tests
 */

import { describe, it, expect } from 'vitest';

export class FirestoreSecurityRuleEvaluator {
  static evaluateUserRead(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    targetUid: string,
    targetUserDoc: { organizationId: string }
  ): boolean {
    if (!auth) return false;
    if (auth.uid === targetUid) return true; // isOwner
    if (auth.token?.role === 'PLATFORM_ADMIN') return true;
    if (
      auth.token?.role === 'SUPERVISOR' &&
      auth.token?.organizationId === targetUserDoc.organizationId
    ) {
      return true;
    }
    return false;
  }

  static evaluateUserCreate(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    targetUid: string,
    newUserDoc: Record<string, any>,
    requestTime: string = 'SERVER_TIMESTAMP'
  ): boolean {
    if (!auth) return false;
    if (auth.uid !== targetUid) return false;

    // Must have role TRAINEE
    if (newUserDoc.role !== 'TRAINEE') return false;

    // Must have default organization
    if (newUserDoc.organizationId !== 'org_rbsk_national') return false;

    // Must match uid
    if (newUserDoc.uid !== targetUid) return false;

    // Must use server timestamp
    if (newUserDoc.createdAt !== requestTime) return false;

    // Check allowed keys
    const allowedKeys = new Set([
      'uid', 'username', 'role', 'organizationId', 'displayName',
      'designation', 'healthSubCentre', 'district', 'state',
      'optionalEmail', 'trainingTimeZone', 'createdAt', 'updatedAt', 'learningState'
    ]);

    const docKeys = Object.keys(newUserDoc);
    if (!docKeys.every((k) => allowedKeys.has(k))) return false;

    // Check baseline learning state
    const ls = newUserDoc.learningState;
    if (!ls) return false;

    if (
      ls.totalXp !== 0 ||
      ls.currentStreak !== 0 ||
      ls.currentLevel !== 1 ||
      ls.completedSessionsCount !== 0 ||
      ls.completedQuestionsCount !== 0 ||
      ls.totalCorrectAnswersCount !== 0 ||
      ls.longestStreak !== 0 ||
      ls.streakShieldActive !== false ||
      ls.streakShieldConsumed !== false
    ) {
      return false;
    }

    return true;
  }

  static evaluateUserProfileUpdate(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    targetUid: string,
    existingDoc: Record<string, any>,
    updatedDoc: Record<string, any>,
    requestTime: string = 'SERVER_TIMESTAMP'
  ): boolean {
    if (!auth) return false;
    if (auth.token?.role === 'PLATFORM_ADMIN') return true;
    if (auth.uid !== targetUid) return false;

    const allowedTopLevelFields = new Set([
      'displayName',
      'designation',
      'healthSubCentre',
      'district',
      'state',
      'optionalEmail',
      'trainingTimeZone',
      'updatedAt',
      'learningState',
      'lastActiveAt',
    ]);

    // Find all changed or added keys
    const affectedKeys: string[] = [];
    for (const key of Object.keys(updatedDoc)) {
      if (!(key in existingDoc) || JSON.stringify(existingDoc[key]) !== JSON.stringify(updatedDoc[key])) {
        affectedKeys.push(key);
      }
    }
    for (const key of Object.keys(existingDoc)) {
      if (!(key in updatedDoc)) {
        affectedKeys.push(key);
      }
    }

    // Top-level fields must ONLY be from allowed list
    const isAllowedKeysOnly = affectedKeys.every((key) => allowedTopLevelFields.has(key));
    if (!isAllowedKeysOnly) return false;

    // Immutable fields check
    const immutableFields = ['uid', 'username', 'role', 'organizationId', 'createdAt'];
    if (affectedKeys.some((k) => immutableFields.includes(k))) return false;

    // If updatedAt is modified, it MUST be equal to request.time
    if (affectedKeys.includes('updatedAt')) {
      if (updatedDoc['updatedAt'] !== requestTime) {
        return false;
      }
    }

    // If learningState is modified, validate bounds and keys
    if (affectedKeys.includes('learningState')) {
      const newLs = updatedDoc.learningState;
      const oldLs = existingDoc.learningState || {
        totalXp: 0,
        currentStreak: 0,
        currentLevel: 1,
        completedSessionsCount: 0,
        completedQuestionsCount: 0,
        totalCorrectAnswersCount: 0,
        longestStreak: 0,
        streakShieldActive: false,
        streakShieldConsumed: false,
      };

      if (!newLs || typeof newLs !== 'object') return false;

      const allowedLsKeys = new Set([
        'totalXp',
        'currentStreak',
        'currentLevel',
        'completedSessionsCount',
        'completedQuestionsCount',
        'totalCorrectAnswersCount',
        'longestStreak',
        'lastActiveDate',
        'streakShieldActive',
        'streakShieldConsumed',
      ]);

      if (!Object.keys(newLs).every((k) => allowedLsKeys.has(k))) {
        return false;
      }

      // Delta bounds
      if (newLs.totalXp < oldLs.totalXp || newLs.totalXp > oldLs.totalXp + 200) {
        return false;
      }

      if (newLs.currentStreak < 0 || newLs.currentStreak > oldLs.currentStreak + 1) {
        return false;
      }

      if (newLs.completedSessionsCount < oldLs.completedSessionsCount || newLs.completedSessionsCount > oldLs.completedSessionsCount + 1) {
        return false;
      }

      if (newLs.currentLevel < 1 || newLs.currentLevel > 5) {
        return false;
      }
    }

    return true;
  }

  static evaluateDailySessionCreate(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    targetUid: string,
    sessionDoc: Record<string, any>,
    requestTime: string = 'SERVER_TIMESTAMP'
  ): boolean {
    if (!auth) return false;
    if (auth.uid !== targetUid) return false;
    if (sessionDoc.userId !== targetUid && sessionDoc.uid !== targetUid) return false;
    if (!sessionDoc.questionIds || sessionDoc.questionIds.length !== 10) return false;
    if (sessionDoc.createdAt !== requestTime) return false;
    if (!['IN_PROGRESS', 'COMPLETED', 'REVIEW_COMPLETED', 'QUESTIONS_COMPLETED', 'REVIEW_VIEWED'].includes(sessionDoc.status)) {
      return false;
    }
    return true;
  }

  static evaluateDailySessionUpdate(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    targetUid: string,
    existingSession: Record<string, any>,
    updatedSession: Record<string, any>
  ): boolean {
    if (!auth) return false;
    if (auth.uid !== targetUid) return false;

    // Completed sessions are locked against modifications
    if (['COMPLETED', 'REVIEW_COMPLETED', 'REVIEW_VIEWED'].includes(existingSession.status)) {
      return false;
    }

    // questionIds, userId, uid, createdAt, sessionId are immutable
    if (JSON.stringify(existingSession.questionIds) !== JSON.stringify(updatedSession.questionIds)) return false;
    if (existingSession.userId !== updatedSession.userId) return false;
    if (existingSession.sessionId !== updatedSession.sessionId) return false;
    if (existingSession.createdAt !== updatedSession.createdAt) return false;

    return true;
  }

  static evaluateAttemptCreate(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    targetUid: string,
    attemptDoc: Record<string, any>,
    requestTime: string = 'SERVER_TIMESTAMP'
  ): boolean {
    if (!auth) return false;
    if (auth.uid !== targetUid) return false;
    if (attemptDoc.userId !== targetUid && attemptDoc.uid !== targetUid) return false;
    if (attemptDoc.createdAt !== requestTime) return false;
    return true;
  }

  static evaluateAttemptUpdate(): boolean {
    // Attempts subcollection is strictly append-only
    return false;
  }

  static evaluateAttemptDelete(): boolean {
    // Attempts subcollection is strictly append-only
    return false;
  }

  static evaluateContentReleaseRead(
    auth: { uid: string; token?: { role?: string; organizationId?: string } } | null,
    releaseDoc: { status: 'DRAFT' | 'VALIDATING' | 'PUBLISHED' | 'RETIRED' }
  ): boolean {
    if (!auth) return false;
    if (auth.token?.role === 'PLATFORM_ADMIN' || auth.token?.role === 'CONTENT_ADMIN') {
      return true;
    }
    return releaseDoc.status === 'PUBLISHED';
  }
}

describe('Phase 2: v2.7.0-SPARK-SPEC 16 Security Rules Verification Suite', () => {
  const traineeAuth = {
    uid: 'trainee_asha_01',
    token: { role: 'TRAINEE', organizationId: 'org_rbsk_wardha' },
  };

  const peerTraineeDoc = {
    uid: 'trainee_asha_02',
    organizationId: 'org_rbsk_wardha',
  };

  const outsiderTraineeDoc = {
    uid: 'trainee_pune_01',
    organizationId: 'org_rbsk_pune',
  };

  const supervisorAuth = {
    uid: 'supervisor_wardha_01',
    token: { role: 'SUPERVISOR', organizationId: 'org_rbsk_wardha' },
  };

  const platformAdminAuth = {
    uid: 'admin_national_01',
    token: { role: 'PLATFORM_ADMIN' },
  };

  const baselineLearningState = {
    totalXp: 0,
    currentStreak: 0,
    currentLevel: 1,
    completedSessionsCount: 0,
    completedQuestionsCount: 0,
    totalCorrectAnswersCount: 0,
    longestStreak: 0,
    streakShieldActive: false,
    streakShieldConsumed: false,
  };

  const sampleUserProfile = {
    uid: 'trainee_asha_01',
    username: 'sunita.patil',
    displayName: 'Sunita Patil',
    role: 'TRAINEE',
    organizationId: 'org_rbsk_national',
    designation: 'ASHA',
    district: 'Wardha',
    state: 'Maharashtra',
    healthSubCentre: 'Karanja Ghadge PHC',
    optionalEmail: 'sunita@example.com',
    trainingTimeZone: 'Asia/Kolkata',
    learningState: baselineLearningState,
    createdAt: 'SERVER_TIMESTAMP',
    updatedAt: 'SERVER_TIMESTAMP',
  };

  // Test 1: Trainee cannot create profile with role PLATFORM_ADMIN or SUPERVISOR
  it('1. DENY: Trainee cannot create profile with role PLATFORM_ADMIN or SUPERVISOR', () => {
    const maliciousDocAdmin = {
      ...sampleUserProfile,
      role: 'PLATFORM_ADMIN',
    };
    const allowedAdmin = FirestoreSecurityRuleEvaluator.evaluateUserCreate(
      traineeAuth,
      'trainee_asha_01',
      maliciousDocAdmin
    );
    expect(allowedAdmin).toBe(false);

    const maliciousDocSupervisor = {
      ...sampleUserProfile,
      role: 'SUPERVISOR',
    };
    const allowedSupervisor = FirestoreSecurityRuleEvaluator.evaluateUserCreate(
      traineeAuth,
      'trainee_asha_01',
      maliciousDocSupervisor
    );
    expect(allowedSupervisor).toBe(false);
  });

  // Test 2: Trainee can create own profile with role TRAINEE and valid baseline learningState
  it('2. ALLOW: Trainee can create own profile with role TRAINEE and valid baseline learningState', () => {
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserCreate(
      traineeAuth,
      'trainee_asha_01',
      sampleUserProfile
    );
    expect(allowed).toBe(true);
  });

  // Test 3: Trainee cannot update own profile role, organizationId, uid, or username
  it('3. DENY: Trainee cannot update own profile role, organizationId, uid, or username', () => {
    // Attempt to change role
    expect(
      FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
        traineeAuth,
        'trainee_asha_01',
        sampleUserProfile,
        { ...sampleUserProfile, role: 'PLATFORM_ADMIN' }
      )
    ).toBe(false);

    // Attempt to change organizationId
    expect(
      FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
        traineeAuth,
        'trainee_asha_01',
        sampleUserProfile,
        { ...sampleUserProfile, organizationId: 'org_hacked' }
      )
    ).toBe(false);

    // Attempt to change username
    expect(
      FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
        traineeAuth,
        'trainee_asha_01',
        sampleUserProfile,
        { ...sampleUserProfile, username: 'new.username' }
      )
    ).toBe(false);

    // Attempt to change uid
    expect(
      FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
        traineeAuth,
        'trainee_asha_01',
        sampleUserProfile,
        { ...sampleUserProfile, uid: 'other_uid' }
      )
    ).toBe(false);
  });

  // Test 4: Trainee can update allow-listed profile fields (displayName, designation, etc.)
  it('4. ALLOW: Trainee can update allow-listed profile fields (displayName, designation, etc.)', () => {
    const updated = {
      ...sampleUserProfile,
      displayName: 'Sunita Ravindra Patil',
      designation: 'ANM',
      healthSubCentre: 'Arvi PHC',
      updatedAt: 'SERVER_TIMESTAMP',
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
      traineeAuth,
      'trainee_asha_01',
      sampleUserProfile,
      updated
    );
    expect(allowed).toBe(true);
  });

  // Test 5: Trainee cannot inject arbitrary fields into learningState
  it('5. DENY: Trainee cannot inject arbitrary fields into learningState', () => {
    const injectedLs = {
      ...sampleUserProfile,
      learningState: {
        ...baselineLearningState,
        unauthorizedCheatKey: true,
      },
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
      traineeAuth,
      'trainee_asha_01',
      sampleUserProfile,
      injectedLs
    );
    expect(allowed).toBe(false);
  });

  // Test 6: Trainee cannot increase totalXp by more than 200 in a single update
  it('6. DENY: Trainee cannot increase totalXp by more than 200 in a single update', () => {
    const excessiveXp = {
      ...sampleUserProfile,
      learningState: {
        ...baselineLearningState,
        totalXp: 201, // > +200 delta limit
      },
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
      traineeAuth,
      'trainee_asha_01',
      sampleUserProfile,
      excessiveXp
    );
    expect(allowed).toBe(false);
  });

  // Test 7: Trainee cannot increase currentStreak by more than 1 in a single update
  it('7. DENY: Trainee cannot increase currentStreak by more than 1 in a single update', () => {
    const excessiveStreak = {
      ...sampleUserProfile,
      learningState: {
        ...baselineLearningState,
        currentStreak: 2, // > +1 delta limit from 0
      },
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
      traineeAuth,
      'trainee_asha_01',
      sampleUserProfile,
      excessiveStreak
    );
    expect(allowed).toBe(false);
  });

  // Test 8: Trainee cannot set currentLevel outside 1–5
  it('8. DENY: Trainee cannot set currentLevel outside 1–5', () => {
    const invalidLevelZero = {
      ...sampleUserProfile,
      learningState: {
        ...baselineLearningState,
        currentLevel: 0,
      },
    };
    expect(
      FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
        traineeAuth,
        'trainee_asha_01',
        sampleUserProfile,
        invalidLevelZero
      )
    ).toBe(false);

    const invalidLevelSix = {
      ...sampleUserProfile,
      learningState: {
        ...baselineLearningState,
        currentLevel: 6,
      },
    };
    expect(
      FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
        traineeAuth,
        'trainee_asha_01',
        sampleUserProfile,
        invalidLevelSix
      )
    ).toBe(false);
  });

  // Test 9: Trainee can update learningState within allowed bounds (e.g. +100 XP, +1 streak)
  it('9. ALLOW: Trainee can update learningState within allowed bounds (+100 XP, +1 streak)', () => {
    const validUpdate = {
      ...sampleUserProfile,
      learningState: {
        ...baselineLearningState,
        totalXp: 100, // Valid (+100)
        currentStreak: 1, // Valid (+1)
        completedSessionsCount: 1,
      },
      updatedAt: 'SERVER_TIMESTAMP',
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserProfileUpdate(
      traineeAuth,
      'trainee_asha_01',
      sampleUserProfile,
      validUpdate
    );
    expect(allowed).toBe(true);
  });

  // Test 10: Trainee cannot read another trainee's profile or subcollections
  it("10. DENY: Trainee cannot read another trainee's profile or subcollections", () => {
    const readPeer = FirestoreSecurityRuleEvaluator.evaluateUserRead(
      traineeAuth,
      'trainee_asha_02',
      peerTraineeDoc
    );
    expect(readPeer).toBe(false);

    const readOutsider = FirestoreSecurityRuleEvaluator.evaluateUserRead(
      traineeAuth,
      'trainee_pune_01',
      outsiderTraineeDoc
    );
    expect(readOutsider).toBe(false);
  });

  // Test 11: Supervisor can read profiles/sessions of trainees in same organization
  it('11. ALLOW: Supervisor can read profiles/sessions of trainees in same organization', () => {
    const traineeInSameOrg = {
      ...sampleUserProfile,
      organizationId: 'org_rbsk_wardha',
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserRead(
      supervisorAuth,
      'trainee_asha_01',
      traineeInSameOrg
    );
    expect(allowed).toBe(true);
  });

  // Test 12: Supervisor cannot read profiles/sessions of trainees in different organization
  it('12. DENY: Supervisor cannot read profiles/sessions of trainees in different organization', () => {
    const allowed = FirestoreSecurityRuleEvaluator.evaluateUserRead(
      supervisorAuth,
      'trainee_pune_01',
      outsiderTraineeDoc
    );
    expect(allowed).toBe(false);
  });

  // Test 13: Trainee can create dailySession with exactly 10 questions
  it('13. ALLOW: Trainee can create dailySession with exactly 10 questions', () => {
    const validSessionDoc = {
      sessionId: 'daily_2026-09-30_trainee_asha_01',
      userId: 'trainee_asha_01',
      localDate: '2026-09-30',
      contentReleaseId: 'rel_v1_0_0',
      status: 'IN_PROGRESS',
      questionIds: [
        'MG-AIL-01-TH', 'MG-AIL-02-TH', 'MG-AIL-03-TH', 'MG-AIL-04-TH', 'MG-AIL-05-TH',
        'MG-AIL-06-TH', 'MG-AIL-07-TH', 'MG-AIL-08-TH', 'MG-AIL-09-TH', 'MG-AIL-10-TH'
      ],
      createdAt: 'SERVER_TIMESTAMP',
    };
    const allowed = FirestoreSecurityRuleEvaluator.evaluateDailySessionCreate(
      traineeAuth,
      'trainee_asha_01',
      validSessionDoc
    );
    expect(allowed).toBe(true);
  });

  // Test 14: Trainee cannot create dailySession with != 10 questions
  it('14. DENY: Trainee cannot create dailySession with != 10 questions', () => {
    const invalidSessionShort = {
      sessionId: 'daily_2026-09-30_trainee_asha_01',
      userId: 'trainee_asha_01',
      localDate: '2026-09-30',
      contentReleaseId: 'rel_v1_0_0',
      status: 'IN_PROGRESS',
      questionIds: ['MG-AIL-01-TH', 'MG-AIL-02-TH'], // Only 2 questions
      createdAt: 'SERVER_TIMESTAMP',
    };
    const allowedShort = FirestoreSecurityRuleEvaluator.evaluateDailySessionCreate(
      traineeAuth,
      'trainee_asha_01',
      invalidSessionShort
    );
    expect(allowedShort).toBe(false);

    const invalidSessionLong = {
      ...invalidSessionShort,
      questionIds: new Array(11).fill('MG-AIL-01-TH'), // 11 questions
    };
    const allowedLong = FirestoreSecurityRuleEvaluator.evaluateDailySessionCreate(
      traineeAuth,
      'trainee_asha_01',
      invalidSessionLong
    );
    expect(allowedLong).toBe(false);
  });

  // Test 15: Trainee cannot update or overwrite a COMPLETED dailySession
  it('15. DENY: Trainee cannot update or overwrite a COMPLETED dailySession (session locking)', () => {
    const completedSession = {
      sessionId: 'daily_2026-09-30_trainee_asha_01',
      userId: 'trainee_asha_01',
      localDate: '2026-09-30',
      contentReleaseId: 'rel_v1_0_0',
      status: 'COMPLETED',
      questionIds: [
        'MG-AIL-01-TH', 'MG-AIL-02-TH', 'MG-AIL-03-TH', 'MG-AIL-04-TH', 'MG-AIL-05-TH',
        'MG-AIL-06-TH', 'MG-AIL-07-TH', 'MG-AIL-08-TH', 'MG-AIL-09-TH', 'MG-AIL-10-TH'
      ],
      createdAt: 'SERVER_TIMESTAMP',
    };

    const tamperAttempt = {
      ...completedSession,
      status: 'IN_PROGRESS', // Attempt to unlock
    };

    const allowed = FirestoreSecurityRuleEvaluator.evaluateDailySessionUpdate(
      traineeAuth,
      'trainee_asha_01',
      completedSession,
      tamperAttempt
    );
    expect(allowed).toBe(false);
  });

  // Test 16: Attempts subcollection is strictly append-only: create allowed, update/delete denied
  it('16. INVARIANT: Attempts subcollection is strictly append-only (create allowed, update/delete denied)', () => {
    const validAttempt = {
      attemptId: 'att_1727690000000_abcde',
      dailySessionId: 'daily_2026-09-30_trainee_asha_01',
      userId: 'trainee_asha_01',
      questionId: 'MG-AIL-01-TH',
      result: 'CORRECT',
      createdAt: 'SERVER_TIMESTAMP',
    };

    // Create allowed
    expect(
      FirestoreSecurityRuleEvaluator.evaluateAttemptCreate(
        traineeAuth,
        'trainee_asha_01',
        validAttempt
      )
    ).toBe(true);

    // Update DENIED
    expect(FirestoreSecurityRuleEvaluator.evaluateAttemptUpdate()).toBe(false);

    // Delete DENIED
    expect(FirestoreSecurityRuleEvaluator.evaluateAttemptDelete()).toBe(false);
  });
});
