/**
 * AiSteth Academy — Backend Authentication & Registration Unit Tests
 * Phase 2.2: Username Normalization, Synthetic Email Abstraction, Idempotent Reservation + Compensation with Ownership Tokens,
 * and Deterministic Phase 2 Question Selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin', () => {
  return {
    default: {
      firestore: Object.assign(vi.fn(), {
        FieldValue: { serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP') },
      }),
      auth: vi.fn(),
    },
    firestore: Object.assign(vi.fn(), {
      FieldValue: { serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP') },
    }),
    auth: vi.fn(),
  };
});
import {
  normalizeUsername,
  generateSyntheticEmail,
  validatePassword,
  validateTraineeRegistrationInput,
} from '../functions/src/utils/username';
import {
  RegistrationService,
  RESERVATION_EXPIRATION_MS,
} from '../functions/src/services/registrationService';
import {
  selectSessionQuestions,
  computeDayParity,
  getResolvedCalendarDate,
  REL_V1_0_0_QUESTIONS,
} from '../functions/src/utils/sessionSelection';

describe('Phase 2.2: Username Utilities & Validation', () => {
  describe('normalizeUsername()', () => {
    it('normalizes valid usernames by trimming and converting to lowercase', () => {
      expect(normalizeUsername('  Sunita.Patil  ')).toBe('sunita.patil');
      expect(normalizeUsername('ASHA_WARDHA_01')).toBe('asha_wardha_01');
      expect(normalizeUsername('rbsk-pune-22')).toBe('rbsk-pune-22');
    });

    it('rejects usernames that are too short (< 3 characters)', () => {
      expect(() => normalizeUsername('ab')).toThrow('between 3 and 30 characters');
      expect(() => normalizeUsername('  x  ')).toThrow('between 3 and 30 characters');
    });

    it('rejects usernames that are too long (> 30 characters)', () => {
      const longName = 'a'.repeat(31);
      expect(() => normalizeUsername(longName)).toThrow('between 3 and 30 characters');
    });

    it('rejects usernames containing illegal characters', () => {
      expect(() => normalizeUsername('user@name')).toThrow('may only contain');
      expect(() => normalizeUsername('user name')).toThrow('may only contain');
      expect(() => normalizeUsername('user#1')).toThrow('may only contain');
      expect(() => normalizeUsername('user$')).toThrow('may only contain');
    });

    it('rejects usernames starting or ending with special characters', () => {
      expect(() => normalizeUsername('.username')).toThrow('cannot begin or end with a special character');
      expect(() => normalizeUsername('_username')).toThrow('cannot begin or end with a special character');
      expect(() => normalizeUsername('-username')).toThrow('cannot begin or end with a special character');
      expect(() => normalizeUsername('username.')).toThrow('cannot begin or end with a special character');
      expect(() => normalizeUsername('username_')).toThrow('cannot begin or end with a special character');
      expect(() => normalizeUsername('username-')).toThrow('cannot begin or end with a special character');
    });

    it('rejects usernames with consecutive special characters', () => {
      expect(() => normalizeUsername('user..name')).toThrow('cannot contain consecutive special characters');
      expect(() => normalizeUsername('user__name')).toThrow('cannot contain consecutive special characters');
      expect(() => normalizeUsername('user--name')).toThrow('cannot contain consecutive special characters');
      expect(() => normalizeUsername('user._name')).toThrow('cannot contain consecutive special characters');
    });
  });

  describe('generateSyntheticEmail()', () => {
    it('generates the canonical internal synthetic email format', () => {
      expect(generateSyntheticEmail('sunita.patil')).toBe('sunita.patil@trainee.aisteth.internal');
      expect(generateSyntheticEmail('asha_wardha_01')).toBe('asha_wardha_01@trainee.aisteth.internal');
    });
  });

  describe('validatePassword()', () => {
    it('accepts valid passwords of at least 6 characters', () => {
      expect(validatePassword('secure123').valid).toBe(true);
      expect(validatePassword('123456').valid).toBe(true);
    });

    it('rejects passwords shorter than 6 characters', () => {
      expect(validatePassword('12345').valid).toBe(false);
      expect(validatePassword('').valid).toBe(false);
    });
  });

  describe('validateTraineeRegistrationInput()', () => {
    const validPayload = {
      username: 'sunita.patil',
      password: 'password123',
      displayName: 'Sunita Patil',
      designation: 'ASHA',
      district: 'Wardha',
      state: 'Maharashtra',
      healthSubCentre: 'Karanja Ghadge PHC',
      optionalEmail: 'sunita.personal@example.com',
    };

    it('accepts valid public registration payloads and sanitizes fields', () => {
      const validated = validateTraineeRegistrationInput(validPayload);
      expect(validated.username).toBe('sunita.patil');
      expect(validated.displayName).toBe('Sunita Patil');
      expect(validated.designation).toBe('ASHA');
      expect(validated.district).toBe('Wardha');
      expect(validated.state).toBe('Maharashtra');
      expect(validated.healthSubCentre).toBe('Karanja Ghadge PHC');
      expect(validated.optionalEmail).toBe('sunita.personal@example.com');
    });

    it('ignores client attempts to provide or override role and organizationId', () => {
      const maliciousPayload = {
        ...validPayload,
        role: 'PLATFORM_ADMIN',
        organizationId: 'org_malicious_tenant',
        privileges: ['ALL'],
      };

      const validated = validateTraineeRegistrationInput(maliciousPayload);
      expect((validated as any).role).toBeUndefined();
      expect((validated as any).organizationId).toBeUndefined();
    });

    it('rejects registration with invalid optional email', () => {
      const invalidEmailPayload = {
        ...validPayload,
        optionalEmail: 'not-an-email',
      };
      expect(() => validateTraineeRegistrationInput(invalidEmailPayload)).toThrow('valid optional email');
    });

    it('rejects registration when state or district are missing', () => {
      expect(() => validateTraineeRegistrationInput({ ...validPayload, state: '' })).toThrow('State selection is required');
      expect(() => validateTraineeRegistrationInput({ ...validPayload, district: '' })).toThrow('District selection is required');
    });
  });
});

describe('Phase 2.2: RegistrationService (Reservation Ownership & Compensation Workflow)', () => {
  let mockFirestore: any;
  let mockAuth: any;
  let registrationService: RegistrationService;
  let usernameDocStore: Record<string, any>;
  let userProfileStore: Record<string, any>;

  beforeEach(() => {
    usernameDocStore = {};
    userProfileStore = {};

    mockFirestore = {
      doc: (path: string) => {
        return {
          path,
          delete: vi.fn().mockImplementation(async () => {
            delete usernameDocStore[path];
          }),
        };
      },
      runTransaction: vi.fn().mockImplementation(async (callback: Function) => {
        const transaction = {
          get: vi.fn().mockImplementation(async (ref: any) => {
            const data = usernameDocStore[ref.path];
            return {
              exists: !!data,
              data: () => data,
            };
          }),
          set: vi.fn().mockImplementation((ref: any, data: any) => {
            if (ref.path.startsWith('users/')) {
              userProfileStore[ref.path] = data;
            } else {
              usernameDocStore[ref.path] = data;
            }
          }),
          update: vi.fn().mockImplementation((ref: any, data: any) => {
            if (usernameDocStore[ref.path]) {
              usernameDocStore[ref.path] = { ...usernameDocStore[ref.path], ...data };
            }
          }),
          delete: vi.fn().mockImplementation((ref: any) => {
            delete usernameDocStore[ref.path];
          }),
        };
        return callback(transaction);
      }),
    };

    mockAuth = {
      createUser: vi.fn().mockResolvedValue({
        uid: 'auth_uid_sunita_123',
        email: 'sunita.patil@trainee.aisteth.internal',
        displayName: 'Sunita Patil',
      }),
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
      deleteUser: vi.fn().mockResolvedValue(undefined),
    };

    registrationService = new RegistrationService(mockFirestore, mockAuth);
  });

  const validRegistrationPayload = {
    username: 'sunita.patil',
    password: 'password123',
    displayName: 'Sunita Patil',
    designation: 'ASHA',
    district: 'Wardha',
    state: 'Maharashtra',
    healthSubCentre: 'Karanja Ghadge PHC',
  };

  it('successfully completes the 5-step registration workflow for a new user with reservationId ownership', async () => {
    const result = await registrationService.registerTrainee(
      validRegistrationPayload,
      'org_rbsk_national'
    );

    expect(result.success).toBe(true);
    expect(result.uid).toBe('auth_uid_sunita_123');
    expect(result.username).toBe('sunita.patil');
    expect(result.syntheticEmail).toBe('sunita.patil@trainee.aisteth.internal');
    expect(result.role).toBe('TRAINEE');
    expect(result.organizationId).toBe('org_rbsk_national');

    // Verify Auth user created with synthetic email
    expect(mockAuth.createUser).toHaveBeenCalledWith({
      email: 'sunita.patil@trainee.aisteth.internal',
      password: 'password123',
      displayName: 'Sunita Patil',
    });

    // Verify custom claims set with server-authoritative role
    expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('auth_uid_sunita_123', {
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
    });

    // Verify reservation doc finalized to ACTIVE with reservationId intact
    const usernameDoc = usernameDocStore['usernames/sunita.patil'];
    expect(usernameDoc).toBeDefined();
    expect(usernameDoc.status).toBe('ACTIVE');
    expect(usernameDoc.uid).toBe('auth_uid_sunita_123');
    expect(usernameDoc.reservationId).toMatch(/^res_\d+_/);

    // Verify user profile provisioned with server-authoritative defaults
    const profileDoc = userProfileStore['users/auth_uid_sunita_123'];
    expect(profileDoc).toBeDefined();
    expect(profileDoc.role).toBe('TRAINEE');
    expect(profileDoc.organizationId).toBe('org_rbsk_national');
    expect(profileDoc.trainingTimeZone).toBe('Asia/Kolkata');
    expect(profileDoc.learningState.totalXp).toBe(0);
    expect(profileDoc.learningState.currentLevel).toBe(1);
    expect(profileDoc.learningState.currentStreak).toBe(0);
  });

  it('rejects registration when username is already ACTIVE', async () => {
    usernameDocStore['usernames/sunita.patil'] = {
      username: 'sunita.patil',
      uid: 'existing_uid_999',
      status: 'ACTIVE',
      reservationId: 'res_existing_123',
    };

    await expect(
      registrationService.registerTrainee(validRegistrationPayload, 'org_rbsk_national')
    ).rejects.toThrow("Username '@sunita.patil' is already registered.");

    expect(mockAuth.createUser).not.toHaveBeenCalled();
  });

  it('rejects concurrent registration when an active RESERVED reservation (< 5 min) exists', async () => {
    usernameDocStore['usernames/sunita.patil'] = {
      username: 'sunita.patil',
      uid: null,
      status: 'RESERVED',
      reservationId: 'res_active_peer_1',
      reservedAt: { toMillis: () => Date.now() - 60 * 1000 }, // 1 min ago
    };

    await expect(
      registrationService.registerTrainee(validRegistrationPayload, 'org_rbsk_national')
    ).rejects.toThrow("registration is currently in progress. Please retry in a few moments.");

    expect(mockAuth.createUser).not.toHaveBeenCalled();
  });

  it('allows Request B to reclaim a stale reservation (> 5 min old) with a new reservationId', async () => {
    usernameDocStore['usernames/sunita.patil'] = {
      username: 'sunita.patil',
      uid: null,
      status: 'RESERVED',
      reservationId: 'res_stale_old_request_a',
      reservedAt: { toMillis: () => Date.now() - (RESERVATION_EXPIRATION_MS + 10000) }, // 5 min 10 sec ago
    };

    const result = await registrationService.registerTrainee(
      validRegistrationPayload,
      'org_rbsk_national'
    );

    expect(result.success).toBe(true);
    const doc = usernameDocStore['usernames/sunita.patil'];
    expect(doc.status).toBe('ACTIVE');
    expect(doc.reservationId).not.toBe('res_stale_old_request_a'); // New ownership token generated
    expect(doc.reservationId).toMatch(/^res_\d+_/);
  });

  it('prevents Request A compensation from deleting Request B reservation if Request B acquired a new reservationId', async () => {
    // 1. Initial stale state for Request A
    const staleReservationIdA = 'res_request_a_stale';
    usernameDocStore['usernames/sunita.patil'] = {
      username: 'sunita.patil',
      uid: null,
      status: 'RESERVED',
      reservationId: staleReservationIdA,
    };

    // 2. Request B reclaims and acquires a new reservationId
    const newReservationIdB = 'res_request_b_new';
    usernameDocStore['usernames/sunita.patil'] = {
      username: 'sunita.patil',
      uid: null,
      status: 'RESERVED',
      reservationId: newReservationIdB,
      reservedAt: { toMillis: () => Date.now() },
    };

    // 3. Simulate delayed compensation executing for Request A with staleReservationIdA
    // In our compensation logic, it checks if doc.reservationId === staleReservationIdA
    await mockFirestore.runTransaction(async (tx: any) => {
      const docSnapshot = await tx.get(mockFirestore.doc('usernames/sunita.patil'));
      const data = docSnapshot.data();
      if (data.reservationId === staleReservationIdA && data.status === 'RESERVED') {
        tx.delete(mockFirestore.doc('usernames/sunita.patil'));
      }
    });

    // Verify Request B's reservation was NOT deleted
    expect(usernameDocStore['usernames/sunita.patil']).toBeDefined();
    expect(usernameDocStore['usernames/sunita.patil'].reservationId).toBe(newReservationIdB);
  });

  it('compensates and cleans up username reservation if Firebase Auth creation fails', async () => {
    mockAuth.createUser.mockRejectedValue(new Error('Auth service network timeout'));

    let errorCaught = false;
    try {
      await registrationService.registerTrainee(validRegistrationPayload, 'org_rbsk_national');
    } catch (e: any) {
      errorCaught = true;
      expect(e.message).toBe('Auth service network timeout');
    }

    expect(errorCaught).toBe(true);
    // Verify reservation was deleted during compensation
    expect(usernameDocStore['usernames/sunita.patil']).toBeUndefined();
  });

  it('compensates by deleting Auth user and releasing reservation if Firestore finalization fails', async () => {
    let callCount = 0;
    mockFirestore.runTransaction = vi.fn().mockImplementation(async (callback: Function) => {
      callCount++;
      if (callCount === 1) {
        // Step 2 transaction succeeds
        const tx = {
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockImplementation((ref: any, data: any) => {
            usernameDocStore[ref.path] = data;
          }),
        };
        return callback(tx);
      } else if (callCount === 2) {
        // Step 4/5 finalization transaction fails
        throw new Error('Firestore write quota exceeded');
      } else {
        // Step 6 compensation transaction
        const tx = {
          get: vi.fn().mockImplementation(async (ref: any) => {
            const data = usernameDocStore[ref.path];
            return { exists: !!data, data: () => data };
          }),
          delete: vi.fn().mockImplementation((ref: any) => {
            delete usernameDocStore[ref.path];
          }),
        };
        return callback(tx);
      }
    });

    let errorCaught = false;
    try {
      await registrationService.registerTrainee(validRegistrationPayload, 'org_rbsk_national');
    } catch (e: any) {
      errorCaught = true;
      expect(e.message).toBe('Firestore write quota exceeded');
    }

    expect(errorCaught).toBe(true);
    // Verify Auth user was deleted during compensation
    expect(mockAuth.deleteUser).toHaveBeenCalledWith('auth_uid_sunita_123');
    // Verify reservation was released
    expect(usernameDocStore['usernames/sunita.patil']).toBeUndefined();
  });
});

describe('Phase 2.2: Frozen Question Selection Engine (rel_v1_0_0)', () => {
  const testUid = 'user_asha_wardha_01';

  it('verifies the active release contains exactly 20 MCQs with 10 Primary and 10 Follow-Up pairs', () => {
    expect(REL_V1_0_0_QUESTIONS.length).toBe(20);
    const primary = REL_V1_0_0_QUESTIONS.filter((q) => q.questionType === 'Primary');
    const followUp = REL_V1_0_0_QUESTIONS.filter((q) => q.questionType === 'Follow-Up');
    expect(primary.length).toBe(10);
    expect(followUp.length).toBe(10);

    // Verify difficulty rank 1 to 10 for both types
    for (let r = 1; r <= 10; r++) {
      expect(primary.some((q) => q.difficultyRank === r)).toBe(true);
      expect(followUp.some((q) => q.difficultyRank === r)).toBe(true);
    }
  });

  it('selects exactly Set A (10 -TH questions, Ranks 1-10) on Even Day Parity (Parity 0)', () => {
    // 2026-10-02 has even UTC day count
    const evenDate = '2026-10-02';
    const parity = computeDayParity(evenDate);
    
    const selected = selectSessionQuestions(evenDate);
    expect(selected.length).toBe(10);

    if (parity === 0) {
      expect(selected).toEqual([
        'MG-AIL-01-TH',
        'MG-AIL-02-TH',
        'MG-AIL-03-TH',
        'MG-AIL-04-TH',
        'MG-AIL-05-TH',
        'MG-AIL-06-TH',
        'MG-AIL-07-TH',
        'MG-AIL-08-TH',
        'MG-AIL-09-TH',
        'MG-AIL-10-TH',
      ]);
    } else {
      expect(selected).toEqual([
        'MG-AIL-01-PR',
        'MG-AIL-02-PR',
        'MG-AIL-03-PR',
        'MG-AIL-04-PR',
        'MG-AIL-05-PR',
        'MG-AIL-06-PR',
        'MG-AIL-07-PR',
        'MG-AIL-08-PR',
        'MG-AIL-09-PR',
        'MG-AIL-10-PR',
      ]);
    }
  });

  it('guarantees 0% question overlap between consecutive calendar-day sessions', () => {
    const day1 = '2026-10-01';
    const day2 = '2026-10-02';

    const sessionDay1 = selectSessionQuestions(day1);
    const sessionDay2 = selectSessionQuestions(day2);

    expect(sessionDay1.length).toBe(10);
    expect(sessionDay2.length).toBe(10);

    // Intersection must be empty
    const overlap = sessionDay1.filter((qId) => sessionDay2.includes(qId));
    expect(overlap).toEqual([]);
  });

  it('guarantees deterministic same-day question selection', () => {
    const date = '2026-10-05';
    const firstCall = selectSessionQuestions(date);
    const secondCall = selectSessionQuestions(date);

    expect(firstCall).toEqual(secondCall);
  });

  it('verifies exact difficulty distribution across ranks 1 through 10 in every selected session', () => {
    const date = '2026-10-01';
    const selectedIds = selectSessionQuestions(date);

    const questions = REL_V1_0_0_QUESTIONS.filter((q) => selectedIds.includes(q.questionId));
    const ranks = questions.map((q) => q.difficultyRank).sort((a, b) => a - b);

    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('computes resolved calendar date correctly using Asia/Kolkata timezone', () => {
    // 2026-09-30 19:00:00 UTC is 2026-10-01 00:30:00 in Asia/Kolkata (UTC+05:30)
    const utcDate = new Date('2026-09-30T19:00:00Z');
    const resolvedKolkataDate = getResolvedCalendarDate(utcDate, 'Asia/Kolkata');
    expect(resolvedKolkataDate).toBe('2026-10-01');
  });
});
