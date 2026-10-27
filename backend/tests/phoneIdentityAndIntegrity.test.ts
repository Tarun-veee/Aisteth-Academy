import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizePhoneNumber } from '../src/domain/rules/phone.js';
import { AuthUseCase, RegistrationAuthenticationError } from '../src/application/usecases/AuthUseCase.js';
import { AdminLearnerUseCase } from '../src/application/usecases/AdminLearnerUseCase.js';
import { IUserRepository } from '../src/domain/interfaces/IUserRepository.js';
import { IAuthProvider } from '../src/domain/interfaces/IAuthProvider.js';
import { IWhatsAppService } from '../src/domain/interfaces/IWhatsAppService.js';
import { WhatsAppOnboardingService } from '../src/infrastructure/external/WhatsAppOnboardingService.js';
import { UserProfileDoc } from '../src/domain/models/user.model.js';

describe('Phase 1: Phone Identity & Account Integrity Suite', () => {
  let mockUserRepo: IUserRepository;
  let mockAuthProvider: IAuthProvider;
  let authUseCase: AuthUseCase;
  let whatsAppService: IWhatsAppService;
  let adminUseCase: AdminLearnerUseCase;

  // In-memory simulation of Firestore phone_numbers and usernames collections
  let simulatedPhoneNumbers: Map<string, { uid: string | null; status: string; reservationId: string; reservedAt: number }>;
  let simulatedUsernames: Map<string, { uid: string | null; status: string; reservationId: string }>;
  let simulatedUsers: Map<string, UserProfileDoc>;

  beforeEach(() => {
    simulatedPhoneNumbers = new Map();
    simulatedUsernames = new Map();
    simulatedUsers = new Map();

    mockUserRepo = {
      findByUid: vi.fn(async (uid: string) => simulatedUsers.get(uid) || null),
      findByUsername: vi.fn(async (username: string) => {
        const entry = simulatedUsernames.get(username);
        if (!entry) return null;
        return { uid: entry.uid, status: entry.status };
      }),
      reserveUsername: vi.fn(async (username: string, reservationId: string) => {
        const entry = simulatedUsernames.get(username);
        if (entry && entry.status === 'ACTIVE') {
          throw new Error(`Username '@${username}' is already registered.`);
        }
        if (entry && entry.status === 'RESERVED') {
          throw new Error(`Username '@${username}' registration is currently in progress.`);
        }
        simulatedUsernames.set(username, { uid: null, status: 'RESERVED', reservationId });
        return true;
      }),
      releaseUsername: vi.fn(async (username: string, reservationId: string, ownerUid?: string) => {
        const entry = simulatedUsernames.get(username);
        if (entry && entry.reservationId === reservationId) {
          if (entry.status === 'RESERVED' || (ownerUid && entry.uid === ownerUid)) {
            simulatedUsernames.delete(username);
          }
        }
      }),
      activateUsername: vi.fn(async (username: string, uid: string, reservationId?: string) => {
        const entry = simulatedUsernames.get(username);
        if (!entry) {
          throw new Error(`Username reservation for '@${username}' was not found.`);
        }
        if (entry.status === 'ACTIVE') {
          if (entry.uid === uid) {
            if (reservationId && entry.reservationId && entry.reservationId !== reservationId) {
              throw new Error(`Username '@${username}' is active under a different reservation.`);
            }
            return;
          }
          throw new Error(`Username '@${username}' is already active for another learner.`);
        }
        if (entry.status !== 'RESERVED') {
          throw new Error(`Username '@${username}' is not in RESERVED status.`);
        }
        if (!reservationId || entry.reservationId !== reservationId) {
          throw new Error(`Username reservation ownership mismatch for '@${username}'. A valid matching reservation ID is required.`);
        }
        simulatedUsernames.set(username, { uid, status: 'ACTIVE', reservationId: reservationId || entry.reservationId });
      }),

      // Phone Identity Methods
      findByPhoneNumber: vi.fn(async (phone: string) => {
        if (!phone || typeof phone !== 'string' || !phone.trim()) {
          return null;
        }
        const norm = normalizePhoneNumber(phone);
        const canonical = norm.valid ? norm.normalized : phone.trim();
        const entry = simulatedPhoneNumbers.get(canonical);
        if (entry) {
          return { uid: entry.uid, status: entry.status };
        }
        // Fallback search in users with candidate formats: canonical E.164, raw 10-digit, 0-prefix, 91-prefix
        const candidates = new Set<string>([canonical, phone.trim()]);
        if (canonical.startsWith('+91') && canonical.length === 13) {
          const raw10 = canonical.slice(3);
          candidates.add(raw10);
          candidates.add(`0${raw10}`);
          candidates.add(`91${raw10}`);
        } else if (/^\d{10}$/.test(phone.trim())) {
          candidates.add(`+91${phone.trim()}`);
          candidates.add(`0${phone.trim()}`);
          candidates.add(`91${phone.trim()}`);
        }
        for (const [uid, user] of simulatedUsers.entries()) {
          if (user.phoneNumber && candidates.has(user.phoneNumber)) {
            return { uid, status: 'ACTIVE' };
          }
        }
        return null;
      }),
      reservePhoneNumber: vi.fn(async (phone: string, reservationId: string) => {
        const entry = simulatedPhoneNumbers.get(phone);
        if (entry && entry.status === 'ACTIVE') {
          throw new Error(`Learner with phone number '${phone}' is already registered.`);
        }
        if (entry && entry.status === 'RESERVED') {
          throw new Error(`Registration for phone number '${phone}' is currently in progress.`);
        }
        // Also check if user exists
        for (const user of simulatedUsers.values()) {
          if (user.phoneNumber === phone) {
            throw new Error(`Learner with phone number '${phone}' is already registered.`);
          }
        }
        simulatedPhoneNumbers.set(phone, { uid: null, status: 'RESERVED', reservationId, reservedAt: Date.now() });
        return true;
      }),
      releasePhoneNumber: vi.fn(async (phone: string, reservationId: string, ownerUid?: string) => {
        const entry = simulatedPhoneNumbers.get(phone);
        if (entry && entry.reservationId === reservationId) {
          if (entry.status === 'RESERVED' || (ownerUid && entry.uid === ownerUid)) {
            simulatedPhoneNumbers.delete(phone);
          }
        }
      }),
      activatePhoneNumber: vi.fn(async (phone: string, uid: string, reservationId?: string) => {
        const entry = simulatedPhoneNumbers.get(phone);
        if (!entry) {
          throw new Error(`Phone reservation for '${phone}' was not found.`);
        }
        if (entry.status === 'ACTIVE') {
          if (entry.uid === uid) {
            if (reservationId && entry.reservationId && entry.reservationId !== reservationId) {
              throw new Error(`Phone number '${phone}' is active under a different reservation.`);
            }
            return;
          }
          throw new Error(`Phone number '${phone}' is already active for another learner.`);
        }
        if (entry.status !== 'RESERVED') {
          throw new Error(`Phone number '${phone}' is not in RESERVED status.`);
        }
        if (!reservationId || entry.reservationId !== reservationId) {
          throw new Error(`Phone reservation ownership mismatch for '${phone}'. A valid matching reservation ID is required.`);
        }
        simulatedPhoneNumbers.set(phone, { uid, status: 'ACTIVE', reservationId: reservationId || entry.reservationId, reservedAt: Date.now() });
      }),

      createUserProfile: vi.fn(async (profile: UserProfileDoc) => {
        simulatedUsers.set(profile.uid, { ...profile });
      }),
      deleteUserProfile: vi.fn(async (uid: string) => {
        simulatedUsers.delete(uid);
      }),
      updateUserProfile: vi.fn(async (uid: string, updates: Partial<UserProfileDoc>) => {
        const existing = simulatedUsers.get(uid);
        if (existing) {
          simulatedUsers.set(uid, { ...existing, ...updates });
        }
      }),
      updateLearningState: vi.fn(),
    };

    let lastCreatedUid = 'mock_uid';

    mockAuthProvider = {
      createUser: vi.fn(async (email: string, _pwd: string, displayName: string) => {
        const uid = `auth_${Math.random().toString(36).substring(2, 9)}`;
        lastCreatedUid = uid;
        return { uid };
      }),
      authenticateWithPassword: vi.fn(async () => ({
        token: 'mock_jwt_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 3600,
        uid: lastCreatedUid,
      })),
      verifyIdToken: vi.fn(),
      refreshToken: vi.fn(),
      deleteUser: vi.fn(async () => {}),
    };

    authUseCase = new AuthUseCase(mockUserRepo, mockAuthProvider);
    whatsAppService = new WhatsAppOnboardingService();
    adminUseCase = new AdminLearnerUseCase(authUseCase, whatsAppService, mockUserRepo);
  });

  // =========================================================================
  // 1. PHONE NUMBER NORMALIZATION TESTS
  // =========================================================================
  describe('1. Phone Number Normalization', () => {
    it('normalizes standard 10-digit Indian numbers starting with 6, 7, 8, or 9 to E.164', () => {
      expect(normalizePhoneNumber('9876543210')).toEqual({ valid: true, normalized: '+919876543210' });
      expect(normalizePhoneNumber('8765432109')).toEqual({ valid: true, normalized: '+918765432109' });
      expect(normalizePhoneNumber('7654321098')).toEqual({ valid: true, normalized: '+917654321098' });
      expect(normalizePhoneNumber('6543210987')).toEqual({ valid: true, normalized: '+916543210987' });
    });

    it('normalizes 11-digit numbers with leading zero', () => {
      expect(normalizePhoneNumber('09876543210')).toEqual({ valid: true, normalized: '+919876543210' });
    });

    it('normalizes 12-digit numbers with 91 country code prefix without plus', () => {
      expect(normalizePhoneNumber('919876543210')).toEqual({ valid: true, normalized: '+919876543210' });
    });

    it('normalizes numbers already having +91 prefix', () => {
      expect(normalizePhoneNumber('+919876543210')).toEqual({ valid: true, normalized: '+919876543210' });
    });

    it('strips spaces, dashes, dots, and parentheses cleanly', () => {
      expect(normalizePhoneNumber('+91 98765-43210')).toEqual({ valid: true, normalized: '+919876543210' });
      expect(normalizePhoneNumber('(98765) 43210')).toEqual({ valid: true, normalized: '+919876543210' });
      expect(normalizePhoneNumber('98765.43210')).toEqual({ valid: true, normalized: '+919876543210' });
    });

    it('accepts general valid international E.164 formats', () => {
      expect(normalizePhoneNumber('+14155552671')).toEqual({ valid: true, normalized: '+14155552671' });
    });

    it('rejects invalid inputs with clear error messages', () => {
      expect(normalizePhoneNumber('')).toEqual({ valid: false, normalized: '', error: 'Phone number is required.' });
      expect(normalizePhoneNumber('12345').valid).toBe(false);
      expect(normalizePhoneNumber('98765432100000000').valid).toBe(false);
      expect(normalizePhoneNumber('abcdefghij').valid).toBe(false);
      expect(normalizePhoneNumber('1234567890').valid).toBe(false); // Does not start with 6,7,8,9
    });
  });

  // =========================================================================
  // 2. UNIQUE PHONE NUMBER RESERVATION & CONCURRENCY
  // =========================================================================
  describe('2. Unique Phone Number Reservation & Concurrency Safety', () => {
    it('reserves an available phone number and sets RESERVED status', async () => {
      const reserved = await mockUserRepo.reservePhoneNumber!('+919876543210', 'res_123');
      expect(reserved).toBe(true);

      const check = await mockUserRepo.findByPhoneNumber!('+919876543210');
      expect(check).toEqual({ uid: null, status: 'RESERVED' });
    });

    it('rejects a duplicate reservation when phone number is already ACTIVE', async () => {
      await mockUserRepo.reservePhoneNumber!('+919876543210', 'res_123');
      await mockUserRepo.activatePhoneNumber!('+919876543210', 'uid_existing_001', 'res_123');

      await expect(
        mockUserRepo.reservePhoneNumber!('+919876543210', 'res_456')
      ).rejects.toThrow("Learner with phone number '+919876543210' is already registered.");
    });

    it('rejects concurrent registration attempt when reservation is currently in progress', async () => {
      await mockUserRepo.reservePhoneNumber!('+919876543210', 'res_123');

      await expect(
        mockUserRepo.reservePhoneNumber!('+919876543210', 'res_second_call')
      ).rejects.toThrow("Registration for phone number '+919876543210' is currently in progress.");
    });

    it('simulates concurrent registration requests for the same phone number where only one succeeds', async () => {
      const phone = '+919876543210';
      const p1 = authUseCase.register({
        username: 'trainee.one',
        password: 'Password@123',
        displayName: 'Trainee One',
        designation: 'ASHA Worker',
        district: 'Bengaluru',
        state: 'Karnataka',
        phoneNumber: phone,
      });

      const p2 = authUseCase.register({
        username: 'trainee.two',
        password: 'Password@123',
        displayName: 'Trainee Two',
        designation: 'ASHA Worker',
        district: 'Bengaluru',
        state: 'Karnataka',
        phoneNumber: phone,
      });

      const results = await Promise.allSettled([p1, p2]);
      const successful = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(/currently in progress|already registered/);
    });
  });

  // =========================================================================
  // 3. ATOMIC PROFILE CREATION WITH PHONE NUMBER
  // =========================================================================
  describe('3. Atomic Initial Profile Creation', () => {
    it('creates initial user profile in Firestore containing phoneNumber atomically on first write', async () => {
      const res = await authUseCase.register({
        username: 'priya.asha',
        password: 'Password@123',
        displayName: 'Priya Sharma',
        designation: 'ASHA Worker',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        phoneNumber: '9876543210',
      });

      expect(res.success).toBe(true);
      const createdUser = simulatedUsers.get(res.profile.id);
      expect(createdUser).toBeDefined();
      expect(createdUser?.phoneNumber).toBe('+919876543210');
      expect(createdUser?.onboardingStatus).toBe('NOT_INITIATED');
      expect(createdUser?.learningState.totalXp).toBe(0);
      expect(createdUser?.learningState.currentStreak).toBe(0);
      expect(createdUser?.learningState.currentLevel).toBe(1);

      // Verify phone number mapping was activated with user's UID
      const phoneMapping = await mockUserRepo.findByPhoneNumber!('+919876543210');
      expect(phoneMapping).toEqual({ uid: res.profile.id, status: 'ACTIVE' });
    });
  });

  // =========================================================================
  // 4. REGISTRATION FAILURE & RETRY RECOVERY
  // =========================================================================
  describe('4. Registration Failure & Clean Compensating Rollback', () => {
    it('releases phone number reservation if auth provider fails mid-flight', async () => {
      vi.spyOn(mockAuthProvider, 'createUser').mockRejectedValueOnce(
        new Error('Firebase Auth simulated service timeout')
      );

      await expect(
        authUseCase.register({
          username: 'anita.temp',
          password: 'Password@123',
          displayName: 'Anita Deshmukh',
          designation: 'ASHA Worker',
          district: 'Nagpur',
          state: 'Maharashtra',
          phoneNumber: '9876543210',
        })
      ).rejects.toThrow('Firebase Auth simulated service timeout');

      // Verify phone number reservation was released and does not block retry
      const checkPhone = await mockUserRepo.findByPhoneNumber!('+919876543210');
      expect(checkPhone).toBeNull();

      // Verify username reservation was also released
      const checkUsername = await mockUserRepo.findByUsername('anita.temp');
      expect(checkUsername).toBeNull();

      // An immediate retry with the same phone number succeeds
      const retryRes = await authUseCase.register({
        username: 'anita.temp',
        password: 'Password@123',
        displayName: 'Anita Deshmukh',
        designation: 'ASHA Worker',
        district: 'Nagpur',
        state: 'Maharashtra',
        phoneNumber: '9876543210',
      });

      expect(retryRes.success).toBe(true);
      expect(simulatedUsers.get(retryRes.profile.id)?.phoneNumber).toBe('+919876543210');
    });

    it('releases phone reservation if Firestore profile write fails', async () => {
      vi.spyOn(mockUserRepo, 'createUserProfile').mockRejectedValueOnce(
        new Error('Firestore profile write quota exceeded')
      );

      await expect(
        authUseCase.register({
          username: 'kavita.fail',
          password: 'Password@123',
          displayName: 'Kavita',
          designation: 'ANM',
          district: 'Pune',
          state: 'Maharashtra',
          phoneNumber: '9876543210',
        })
      ).rejects.toThrow('Firestore profile write quota exceeded');

      // Verify phone reservation released
      const checkPhone = await mockUserRepo.findByPhoneNumber!('+919876543210');
      expect(checkPhone).toBeNull();
    });
  });

  // =========================================================================
  // 5. BULK CSV AND SINGLE REGISTRATION CONSISTENCY
  // =========================================================================
  describe('5. Single & Bulk Onboarding Consistency', () => {
    it('applies the exact same phone normalization and duplicate protection across bulk import', async () => {
      // 1. Pre-register a learner via single registration
      await authUseCase.register({
        username: 'existing.asha',
        password: 'Password@123',
        displayName: 'Existing ASHA',
        designation: 'ASHA Worker',
        district: 'Mysuru',
        state: 'Karnataka',
        phoneNumber: '9876543210',
      });

      // 2. Perform bulk import containing the same phone, an intra-batch duplicate, and a new learner
      const bulkRows = [
        {
          displayName: 'Duplicate Learner (Pre-existing)',
          phoneNumber: '09876543210', // Leading zero format of the same number
          district: 'Mysuru',
          state: 'Karnataka',
          designation: 'ASHA Worker',
        },
        {
          displayName: 'New Learner One',
          phoneNumber: '9123456780',
          district: 'Mysuru',
          state: 'Karnataka',
          designation: 'ASHA Worker',
        },
        {
          displayName: 'New Learner One (Intra-batch duplicate)',
          phoneNumber: '+919123456780',
          district: 'Mysuru',
          state: 'Karnataka',
          designation: 'ASHA Worker',
        },
      ];

      const bulkResult = await adminUseCase.bulkImportLearners(bulkRows);

      expect(bulkResult.totalRows).toBe(3);
      expect(bulkResult.successCount).toBe(1);
      expect(bulkResult.skippedCount).toBe(2);
      expect(bulkResult.failedCount).toBe(0);

      // Pre-existing duplicate was skipped
      const skippedPreExisting = bulkResult.results.find((r) => r.rowNumber === 1);
      expect(skippedPreExisting?.status).toBe('SKIPPED_DUPLICATE');

      // New learner succeeded
      const successfulNew = bulkResult.results.find((r) => r.rowNumber === 2);
      expect(successfulNew?.status).toBe('SUCCESS');

      // Intra-batch duplicate was skipped
      const skippedIntraBatch = bulkResult.results.find((r) => r.rowNumber === 3);
      expect(skippedIntraBatch?.status).toBe('SKIPPED_DUPLICATE');
    });
  });

  // =========================================================================
  // 6. PRESERVATION OF EXISTING LEARNER PROGRESS
  // =========================================================================
  describe('6. Preservation of Existing Learner Progress & Learning State', () => {
    it('does not overwrite or reset existing learner progress when duplicate phone import is attempted', async () => {
      // 1. Manually populate existing active learner with 450 XP, 7-day streak, Level 3
      const existingUid = 'active_trainee_789';
      simulatedUsers.set(existingUid, {
        uid: existingUid,
        username: 'sunita.expert',
        syntheticEmail: 'sunita.expert@trainee.aisteth.internal',
        displayName: 'Sunita Patil',
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: 'Senior ASHA',
        healthSubCentre: 'HSC Rural',
        district: 'Amravati',
        state: 'Maharashtra',
        phoneNumber: '+919876543210',
        trainingTimeZone: 'Asia/Kolkata',
        learningState: {
          totalXp: 450,
          currentStreak: 7,
          longestStreak: 10,
          lastActiveDate: '2026-10-22',
          completedQuestionsCount: 60,
          completedSessionsCount: 6,
          totalCorrectAnswersCount: 52,
          currentLevel: 3,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      simulatedPhoneNumbers.set('+919876543210', {
        uid: existingUid,
        status: 'ACTIVE',
        reservationId: '',
        reservedAt: Date.now(),
      });

      // 2. Attempt single registration with the same phone number
      await expect(
        adminUseCase.registerSingleLearner({
          displayName: 'Sunita Patil Duplicate Attempt',
          phoneNumber: '9876543210',
          designation: 'ASHA Worker',
          district: 'Amravati',
          state: 'Maharashtra',
        })
      ).rejects.toThrow("already registered");

      // 3. Verify existing learner state remains completely intact
      const preservedUser = simulatedUsers.get(existingUid);
      expect(preservedUser?.learningState.totalXp).toBe(450);
      expect(preservedUser?.learningState.currentStreak).toBe(7);
      expect(preservedUser?.learningState.currentLevel).toBe(3);
      expect(preservedUser?.learningState.completedSessionsCount).toBe(6);
    });
  });

  // =========================================================================
  // 7. ROLLBACK INTEGRITY, OWNERSHIP VERIFICATION & COMMIT BOUNDARY REGRESSION SUITE
  // =========================================================================
  describe('7. Rollback Integrity, Ownership Verification & Commit Boundary Regression', () => {
    it('does not delete committed account or mappings when token-generation fails post-activation', async () => {
      // Step 6 fails (simulating Google Identity Toolkit timeout/network issue after activation)
      vi.spyOn(mockAuthProvider, 'authenticateWithPassword').mockRejectedValueOnce(
        new Error('Google Identity Toolkit temporary connection timeout')
      );

      let caughtError: any = null;
      try {
        await authUseCase.register({
          username: 'savita.committed',
          password: 'Password@123',
          displayName: 'Savita Committed',
          designation: 'ASHA Worker',
          district: 'Nagpur',
          state: 'Maharashtra',
          phoneNumber: '9876543210',
        });
      } catch (err: any) {
        caughtError = err;
      }

      // 1. Error is thrown clearly signaling that token acquisition failed
      expect(caughtError).toBeInstanceOf(RegistrationAuthenticationError);
      expect(caughtError.message).toContain('automatic session creation failed');

      // 2. The account was COMMITTED: Auth user was NOT deleted
      expect(mockAuthProvider.deleteUser).not.toHaveBeenCalled();

      // 3. Firestore profile remains intact and valid
      const committedUid = caughtError.uid;
      const userDoc = simulatedUsers.get(committedUid);
      expect(userDoc).toBeDefined();
      expect(userDoc?.username).toBe('savita.committed');
      expect(userDoc?.phoneNumber).toBe('+919876543210');

      // 4. Username and Phone mappings remain ACTIVE pointing to committed UID
      expect(simulatedUsernames.get('savita.committed')?.status).toBe('ACTIVE');
      expect(simulatedUsernames.get('savita.committed')?.uid).toBe(committedUid);
      expect(simulatedPhoneNumbers.get('+919876543210')?.status).toBe('ACTIVE');
      expect(simulatedPhoneNumbers.get('+919876543210')?.uid).toBe(committedUid);

      // 5. Learner can successfully log in using their credentials
      const loginRes = await authUseCase.login({
        identifier: 'savita.committed',
        password: 'Password@123',
      });
      expect(loginRes.success).toBe(true);
      expect(loginRes.profile.id).toBe(committedUid);
    });

    it('performs clean compensating cleanup when username activation succeeds but phone activation fails', async () => {
      // Step 5b fails: phone activation throws mid-flight
      vi.spyOn(mockUserRepo, 'activatePhoneNumber' as any).mockRejectedValueOnce(
        new Error('Firestore phone_numbers mapping transaction failure')
      );

      await expect(
        authUseCase.register({
          username: 'rekha.partial',
          password: 'Password@123',
          displayName: 'Rekha Partial',
          designation: 'ANM',
          district: 'Solapur',
          state: 'Maharashtra',
          phoneNumber: '9876543210',
        })
      ).rejects.toThrow('Firestore phone_numbers mapping transaction failure');

      // 1. Auth user was deleted
      expect(mockAuthProvider.deleteUser).toHaveBeenCalled();

      // 2. User profile was deleted
      expect(simulatedUsers.size).toBe(0);

      // 3. Username mapping was released and NOT left as ACTIVE pointing to dead UID
      expect(simulatedUsernames.get('rekha.partial')).toBeUndefined();

      // 4. Phone reservation was released
      expect(simulatedPhoneNumbers.get('+919876543210')).toBeUndefined();

      // 5. User can immediately re-register with the same username and phone number
      const retryRes = await authUseCase.register({
        username: 'rekha.partial',
        password: 'Password@123',
        displayName: 'Rekha Partial',
        designation: 'ANM',
        district: 'Solapur',
        state: 'Maharashtra',
        phoneNumber: '9876543210',
      });
      expect(retryRes.success).toBe(true);
      expect(simulatedUsers.get(retryRes.profile.id)?.username).toBe('rekha.partial');
    });

    it('phone activation rejects an invalid or stale reservation ID', async () => {
      await mockUserRepo.reservePhoneNumber!('+919876543210', 'res_active_owner');

      await expect(
        mockUserRepo.activatePhoneNumber!('+919876543210', 'uid_123', 'res_stale_intruder')
      ).rejects.toThrow(/ownership mismatch/);

      // Status remains RESERVED with the original owner
      expect(simulatedPhoneNumbers.get('+919876543210')?.status).toBe('RESERVED');
      expect(simulatedPhoneNumbers.get('+919876543210')?.reservationId).toBe('res_active_owner');
    });

    it('username activation rejects stale reservation ownership', async () => {
      await mockUserRepo.reserveUsername('varun.test', 'res_legit_owner');

      await expect(
        mockUserRepo.activateUsername('varun.test', 'uid_456', 'res_stale_owner')
      ).rejects.toThrow(/ownership mismatch/);

      // Status remains RESERVED with original owner
      expect(simulatedUsernames.get('varun.test')?.status).toBe('RESERVED');
      expect(simulatedUsernames.get('varun.test')?.reservationId).toBe('res_legit_owner');
    });

    it('prevents an older delayed request from overwriting a reservation reclaimed by a newer request', async () => {
      // 1. Request A reserves phone
      await mockUserRepo.reservePhoneNumber!('+919876543210', 'res_request_A');

      // 2. Reservation expires / is reclaimed by Request B
      simulatedPhoneNumbers.set('+919876543210', {
        uid: null,
        status: 'RESERVED',
        reservationId: 'res_request_B',
        reservedAt: Date.now(),
      });

      // 3. Request A wakes up after lag and attempts to activate phone with res_request_A
      await expect(
        mockUserRepo.activatePhoneNumber!('+919876543210', 'uid_delayed_A', 'res_request_A')
      ).rejects.toThrow(/ownership mismatch/);

      // Verify Request B's reservation was NOT overwritten
      const phoneEntry = simulatedPhoneNumbers.get('+919876543210');
      expect(phoneEntry?.status).toBe('RESERVED');
      expect(phoneEntry?.reservationId).toBe('res_request_B');
      expect(phoneEntry?.uid).toBeNull();
    });

    it('cleanup from an older request does not remove another request’s reclaimed reservation', async () => {
      // 1. Request B has active reservation
      simulatedPhoneNumbers.set('+919876543210', {
        uid: null,
        status: 'RESERVED',
        reservationId: 'res_request_B',
        reservedAt: Date.now(),
      });

      // 2. Request A fails and its catch block invokes releasePhoneNumber with its old reservation ID
      await mockUserRepo.releasePhoneNumber!('+919876543210', 'res_request_A');

      // 3. Request B's reservation remains untouched
      const phoneEntry = simulatedPhoneNumbers.get('+919876543210');
      expect(phoneEntry).toBeDefined();
      expect(phoneEntry?.reservationId).toBe('res_request_B');
    });

    it('allows clean retry after a recoverable pre-commit failure', async () => {
      // First attempt fails at profile creation
      vi.spyOn(mockUserRepo, 'createUserProfile').mockRejectedValueOnce(
        new Error('Temporary Firestore write unavailable')
      );

      await expect(
        authUseCase.register({
          username: 'leela.retry',
          password: 'Password@123',
          displayName: 'Leela Retry',
          designation: 'CHO',
          district: 'Nashik',
          state: 'Maharashtra',
          phoneNumber: '9876543210',
        })
      ).rejects.toThrow('Temporary Firestore write unavailable');

      // Confirm clean state
      expect(simulatedUsers.size).toBe(0);
      expect(simulatedPhoneNumbers.get('+919876543210')).toBeUndefined();
      expect(simulatedUsernames.get('leela.retry')).toBeUndefined();

      // Retry immediately succeeds
      const retryResult = await authUseCase.register({
        username: 'leela.retry',
        password: 'Password@123',
        displayName: 'Leela Retry',
        designation: 'CHO',
        district: 'Nashik',
        state: 'Maharashtra',
        phoneNumber: '9876543210',
      });

      expect(retryResult.success).toBe(true);
      expect(simulatedUsers.get(retryResult.profile.id)?.username).toBe('leela.retry');
    });

    it('resolves legacy phone records stored in various unnormalized formats', async () => {
      // 1. Seed 4 legacy users with different phone representations
      simulatedUsers.set('user_legacy_10digit', {
        uid: 'user_legacy_10digit',
        username: 'legacy.raw10',
        syntheticEmail: 'legacy.raw10@trainee.aisteth.internal',
        displayName: 'Legacy Raw 10',
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: 'ASHA',
        healthSubCentre: 'PHC',
        district: 'Pune',
        state: 'Maharashtra',
        phoneNumber: '9876543211', // raw 10 digits
        trainingTimeZone: 'Asia/Kolkata',
        learningState: { totalXp: 10, currentStreak: 1, longestStreak: 1, lastActiveDate: null, completedQuestionsCount: 1, completedSessionsCount: 1, totalCorrectAnswersCount: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      simulatedUsers.set('user_legacy_leadzero', {
        uid: 'user_legacy_leadzero',
        username: 'legacy.zero',
        syntheticEmail: 'legacy.zero@trainee.aisteth.internal',
        displayName: 'Legacy Zero',
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: 'ASHA',
        healthSubCentre: 'PHC',
        district: 'Pune',
        state: 'Maharashtra',
        phoneNumber: '09876543212', // leading zero
        trainingTimeZone: 'Asia/Kolkata',
        learningState: { totalXp: 10, currentStreak: 1, longestStreak: 1, lastActiveDate: null, completedQuestionsCount: 1, completedSessionsCount: 1, totalCorrectAnswersCount: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      simulatedUsers.set('user_legacy_prefix91', {
        uid: 'user_legacy_prefix91',
        username: 'legacy.p91',
        syntheticEmail: 'legacy.p91@trainee.aisteth.internal',
        displayName: 'Legacy 91',
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: 'ASHA',
        healthSubCentre: 'PHC',
        district: 'Pune',
        state: 'Maharashtra',
        phoneNumber: '919876543213', // 91 without plus
        trainingTimeZone: 'Asia/Kolkata',
        learningState: { totalXp: 10, currentStreak: 1, longestStreak: 1, lastActiveDate: null, completedQuestionsCount: 1, completedSessionsCount: 1, totalCorrectAnswersCount: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      simulatedUsers.set('user_legacy_canonical', {
        uid: 'user_legacy_canonical',
        username: 'legacy.e164',
        syntheticEmail: 'legacy.e164@trainee.aisteth.internal',
        displayName: 'Legacy E164',
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: 'ASHA',
        healthSubCentre: 'PHC',
        district: 'Pune',
        state: 'Maharashtra',
        phoneNumber: '+919876543214', // canonical E.164
        trainingTimeZone: 'Asia/Kolkata',
        learningState: { totalXp: 10, currentStreak: 1, longestStreak: 1, lastActiveDate: null, completedQuestionsCount: 1, completedSessionsCount: 1, totalCorrectAnswersCount: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Querying with normalized +91 finds the raw 10-digit legacy profile
      const r1 = await mockUserRepo.findByPhoneNumber!('+919876543211');
      expect(r1?.uid).toBe('user_legacy_10digit');

      // 3. Querying with normalized +91 finds the leading-zero legacy profile
      const r2 = await mockUserRepo.findByPhoneNumber!('+919876543212');
      expect(r2?.uid).toBe('user_legacy_leadzero');

      // 4. Querying with normalized +91 finds the 91-prefix legacy profile
      const r3 = await mockUserRepo.findByPhoneNumber!('+919876543213');
      expect(r3?.uid).toBe('user_legacy_prefix91');

      // 5. Querying with raw 10-digit finds the canonical E.164 profile
      const r4 = await mockUserRepo.findByPhoneNumber!('9876543214');
      expect(r4?.uid).toBe('user_legacy_canonical');
    });

    it('rejects phone activation when reservationId is omitted', async () => {
      await mockUserRepo.reservePhoneNumber!('+919876543210', 'res_secret');

      await expect(
        mockUserRepo.activatePhoneNumber!('+919876543210', 'uid_hacker')
      ).rejects.toThrow(/reservation ID is required|ownership mismatch/);

      expect(simulatedPhoneNumbers.get('+919876543210')?.status).toBe('RESERVED');
    });

    it('rejects username activation when reservationId is omitted', async () => {
      await mockUserRepo.reserveUsername('omitted.user', 'res_secret_user');

      await expect(
        mockUserRepo.activateUsername('omitted.user', 'uid_hacker')
      ).rejects.toThrow(/reservation ID is required|ownership mismatch/);

      expect(simulatedUsernames.get('omitted.user')?.status).toBe('RESERVED');
    });

    it('gracefully returns null for empty, whitespace, or invalid phone lookup', async () => {
      expect(await mockUserRepo.findByPhoneNumber!('')).toBeNull();
      expect(await mockUserRepo.findByPhoneNumber!('   ')).toBeNull();
      expect(await mockUserRepo.findByPhoneNumber!(null as any)).toBeNull();
      expect(await mockUserRepo.findByPhoneNumber!(undefined as any)).toBeNull();
    });

    it('authenticates learner via registered phone number for custom usernames', async () => {
      // 1. Register learner with custom username and phone number
      const reg = await authUseCase.register({
        username: 'anita.custom',
        password: 'Password@123',
        displayName: 'Anita Custom',
        designation: 'Senior ANM',
        district: 'Wardha',
        state: 'Maharashtra',
        phoneNumber: '9876543210',
      });
      expect(reg.success).toBe(true);

      // 2. Sign in using phone number instead of username
      const loginWithPhone = await authUseCase.login({
        identifier: '9876543210',
        password: 'Password@123',
      });
      expect(loginWithPhone.success).toBe(true);
      expect(loginWithPhone.profile.id).toBe(reg.profile.id);
      expect(loginWithPhone.profile.name).toBe('Anita Custom');

      // 3. Sign in using canonical E.164 phone format
      const loginWithE164 = await authUseCase.login({
        identifier: '+919876543210',
        password: 'Password@123',
      });
      expect(loginWithE164.success).toBe(true);
      expect(loginWithE164.profile.id).toBe(reg.profile.id);
    });

    it('preserves the original registration error even if compensating cleanup itself encounters an error', async () => {
      vi.spyOn(mockAuthProvider, 'createUser').mockRejectedValueOnce(
        new Error('CRITICAL_AUTH_FAILURE')
      );
      // Simulate cleanup warning / failure
      vi.spyOn(mockUserRepo, 'releaseUsername').mockRejectedValueOnce(
        new Error('CLEANUP_FAILED_ERROR')
      );

      await expect(
        authUseCase.register({
          username: 'error.test',
          password: 'Password@123',
          displayName: 'Error Test',
          designation: 'ASHA',
          district: 'Nagpur',
          state: 'Maharashtra',
          phoneNumber: '9876543210',
        })
      ).rejects.toThrow('CRITICAL_AUTH_FAILURE'); // Original error must be preserved
    });
  });
});
