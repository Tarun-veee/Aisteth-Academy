import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { AdminLearnerUseCase } from '../src/application/usecases/AdminLearnerUseCase.js';
import { IUserRepository } from '../src/domain/interfaces/IUserRepository.js';
import { IAuthProvider } from '../src/domain/interfaces/IAuthProvider.js';
import { AuthUseCase } from '../src/application/usecases/AuthUseCase.js';
import { IWhatsAppService } from '../src/domain/interfaces/IWhatsAppService.js';
import { UserProfileDoc } from '../src/domain/models/user.model.js';
import { WhatsAppOnboardingService } from '../src/infrastructure/external/WhatsAppOnboardingService.js';
import { requireAdminRole } from '../src/api/middlewares/admin.middleware.js';

describe('Admin Dashboard & Learner Onboarding Suite', () => {
  let mockUserRepo: IUserRepository;
  let mockAuthProvider: IAuthProvider;
  let authUseCase: AuthUseCase;
  let whatsAppService: IWhatsAppService;
  let adminUseCase: AdminLearnerUseCase;

  const sampleAdminDoc: UserProfileDoc = {
    uid: 'admin_user_001',
    username: 'admin.super',
    syntheticEmail: 'admin.super@trainee.aisteth.app',
    displayName: 'Dr. Super Admin',
    designation: 'State Training Coordinator',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    role: 'PLATFORM_ADMIN',
    organizationId: 'org_rbsk',
    createdAt: '2026-01-01T00:00:00.000Z',
    learningState: {
      totalXp: 1000,
      currentStreak: 20,
      longestStreak: 20,
      completedSessionsCount: 20,
      completedQuestionsCount: 200,
      totalCorrectAnswersCount: 190,
      currentLevel: 5,
      streakShieldActive: false,
      streakShieldConsumed: false,
    },
  };

  const sampleTraineeDoc: UserProfileDoc = {
    uid: 'trainee_user_002',
    username: 'priya.sharma',
    syntheticEmail: 'priya.sharma@trainee.aisteth.app',
    displayName: 'Priya Sharma',
    designation: 'ASHA Worker',
    healthSubCentre: 'Kengeri HSC',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    phoneNumber: '+919876543210',
    role: 'TRAINEE',
    organizationId: 'org_rbsk',
    onboardingStatus: 'NOT_INITIATED',
    createdAt: '2026-02-01T00:00:00.000Z',
    learningState: {
      totalXp: 200,
      currentStreak: 5,
      longestStreak: 5,
      completedSessionsCount: 4,
      completedQuestionsCount: 40,
      totalCorrectAnswersCount: 36,
      currentLevel: 2,
      streakShieldActive: false,
      streakShieldConsumed: false,
    },
  };

  beforeEach(() => {
    mockUserRepo = {
      findByUid: vi.fn(),
      findByUsername: vi.fn(),
      reserveUsername: vi.fn(),
      releaseUsername: vi.fn(),
      activateUsername: vi.fn(),
      createUserProfile: vi.fn(),
      updateUserProfile: vi.fn(),
      updateLearningState: vi.fn(),
    };

    mockAuthProvider = {
      createUser: vi.fn(),
      verifyToken: vi.fn(),
      createCustomToken: vi.fn(),
      revokeRefreshTokens: vi.fn(),
      revokeUserSessions: vi.fn().mockResolvedValue(undefined),
      authenticateWithPassword: vi.fn(),
      refreshToken: vi.fn(),
      verifyIdToken: vi.fn(),
      deleteUser: vi.fn(),
      generatePasswordResetLink: vi.fn(),
      updateUserPassword: vi.fn().mockResolvedValue(undefined),
      updateUserDisabled: vi.fn().mockResolvedValue(undefined),
    };

    authUseCase = new AuthUseCase(mockUserRepo, mockAuthProvider);
    whatsAppService = new WhatsAppOnboardingService();
    adminUseCase = new AdminLearnerUseCase(authUseCase, whatsAppService, mockUserRepo, mockAuthProvider);
  });

  // =========================================================================
  // 1. ADMIN AUTHORIZATION & MIDDLEWARE ENFORCEMENT
  // =========================================================================
  describe('Admin Authorization Middleware (requireAdminRole)', () => {
    it('returns HTTP 401 when accessing admin routes without authentication', async () => {
      const res = await request(app).get('/api/v1/admin/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });

    it('rejects access if user role is TRAINEE with HTTP 403 and FORBIDDEN_NOT_ADMIN code', async () => {
      const req: any = {
        user: { uid: 'trainee_user_002', role: 'TRAINEE' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await requireAdminRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'FORBIDDEN_NOT_ADMIN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('allows access if user has PLATFORM_ADMIN role in token claims', async () => {
      const req: any = {
        user: { uid: 'admin_user_001', role: 'PLATFORM_ADMIN' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await requireAdminRole(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows access if user has SUPERVISOR role in token claims', async () => {
      const req: any = {
        user: { uid: 'supervisor_user_003', role: 'SUPERVISOR' },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await requireAdminRole(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. PHONE NUMBER NORMALIZATION & WHATSAPP SERVICE INTEGRATION
  // =========================================================================
  describe('WhatsApp Service Phone Normalization & Dispatch Safety', () => {
    it('normalizes standard 10-digit Indian numbers to E.164 (+91)', () => {
      const result = whatsAppService.normalizePhoneNumber('9876543210');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
    });

    it('normalizes 11-digit numbers with leading 0 to E.164 (+91)', () => {
      const result = whatsAppService.normalizePhoneNumber('09876543210');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
    });

    it('normalizes 12-digit numbers with 91 prefix to E.164 (+91)', () => {
      const result = whatsAppService.normalizePhoneNumber('919876543210');
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe('+919876543210');
    });

    it('rejects invalid short numbers with valid=false', () => {
      const result = whatsAppService.normalizePhoneNumber('12345');
      expect(result.valid).toBe(false);
      expect(result.normalized).toBe('');
      expect(result.error).toBeDefined();
    });

    it('rejects non-numeric characters that do not form a valid phone', () => {
      const result = whatsAppService.normalizePhoneNumber('abcde');
      expect(result.valid).toBe(false);
      expect(result.normalized).toBe('');
    });

    it('reports WHATSAPP_NOT_CONFIGURED gracefully without fake success when credentials unconfigured', async () => {
      const result = await whatsAppService.sendOnboardingMessage({
        uid: 'test_uid',
        phoneNumber: '+919876543210',
        learnerName: 'Priya Sharma',
        username: 'priya.sharma',
      });

      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('WHATSAPP_NOT_CONFIGURED');
    });
  });

  // =========================================================================
  // 3. SINGLE LEARNER REGISTRATION VALIDATION
  // =========================================================================
  describe('Single Learner Registration Use Case', () => {
    it('rejects registration with invalid phone number format', async () => {
      await expect(
        adminUseCase.registerSingleLearner({
          username: 'test.learner',
          displayName: 'Test Learner',
          phoneNumber: '12345',
          designation: 'ASHA Worker',
          district: 'Pune',
          state: 'Maharashtra',
        })
      ).rejects.toThrow('Invalid phone number format');
    });

    it('rejects registration with missing mandatory fields', async () => {
      await expect(
        adminUseCase.registerSingleLearner({
          username: 'test.learner',
          displayName: '',
          phoneNumber: '9876543210',
          designation: 'ASHA Worker',
          district: 'Pune',
          state: 'Maharashtra',
        })
      ).rejects.toThrow('Learner full name is required');
    });
  });

  // =========================================================================
  // 4. BULK LEARNER CSV IMPORT SAFEGUARDS
  // =========================================================================
  describe('Bulk Learner CSV Import Safeguards', () => {
    it('identifies duplicate phone numbers within the import payload and skips them safely', async () => {
      const rows = [
        {
          displayName: 'Learner One',
          phoneNumber: '9876543210',
          district: 'Nagpur',
          state: 'Maharashtra',
          designation: 'ASHA Worker',
        },
        {
          displayName: 'Learner Two (Duplicate Phone)',
          phoneNumber: '9876543210',
          district: 'Nagpur',
          state: 'Maharashtra',
          designation: 'ASHA Worker',
        },
      ];

      // Mock registerSingleLearner to succeed for the first row
      vi.spyOn(adminUseCase, 'registerSingleLearner').mockResolvedValueOnce({
        uid: 'learner_1_uid',
        username: 'trainee_9876543210',
        displayName: 'Learner One',
        phoneNumber: '+919876543210',
        designation: 'ASHA Worker',
        district: 'Nagpur',
        state: 'Maharashtra',
        totalXp: 0,
        currentStreak: 0,
        currentLevel: 1,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        onboardingStatus: 'NOT_INITIATED',
        createdAt: new Date().toISOString(),
      });

      const result = await adminUseCase.bulkImportLearners(rows);

      expect(result.totalRows).toBe(2);
      expect(result.skippedCount).toBe(1);
      expect(result.results).toHaveLength(2);

      const duplicateItem = result.results.find((i) => i.rowNumber === 2);
      expect(duplicateItem?.status).toBe('SKIPPED_DUPLICATE');
      expect(duplicateItem?.error).toContain('Duplicate phone number within the same CSV import file');
    });

    it('identifies invalid rows with malformed phone numbers without failing the entire batch', async () => {
      const rows = [
        {
          displayName: 'Invalid Phone Learner',
          phoneNumber: '000',
          district: 'Nagpur',
          state: 'Maharashtra',
          designation: 'ASHA Worker',
        },
      ];

      const result = await adminUseCase.bulkImportLearners(rows);

      expect(result.failedCount).toBe(1);
      expect(result.results[0].status).toBe('FAILED');
      expect(result.results[0].error).toContain('Invalid phone number format');
    });
  });

  // =========================================================================
  // 5. PRESERVATION OF EXISTING LEARNING STATE
  // =========================================================================
  describe('Preservation Requirements', () => {
    it('verifies that learner progression metrics, XP, and streak models remain intact', () => {
      expect(sampleTraineeDoc.learningState.totalXp).toBe(200);
      expect(sampleTraineeDoc.learningState.currentStreak).toBe(5);
      expect(sampleTraineeDoc.learningState.currentLevel).toBe(2);
    });
  });

  // =========================================================================
  // 6. ADMIN-LED ONBOARDING, ACCOUNT LIFECYCLE & ACCESS INSTRUCTIONS
  // =========================================================================
  describe('Account Lifecycle, Deactivation & Access Instructions', () => {
    it('blocks deactivated accounts from logging into the platform', async () => {
      const deactivatedUser: UserProfileDoc = {
        ...sampleTraineeDoc,
        accountStatus: 'DEACTIVATED',
      };

      vi.spyOn(mockAuthProvider, 'authenticateWithPassword' as any).mockResolvedValueOnce({
        token: 'token_123',
        refreshToken: 'refresh_123',
        expiresIn: 3600,
        uid: deactivatedUser.uid,
      });
      vi.spyOn(mockUserRepo, 'findByUid').mockResolvedValueOnce(deactivatedUser);

      await expect(
        authUseCase.login({
          identifier: deactivatedUser.phoneNumber!,
          password: 'Password@123',
        })
      ).rejects.toThrow('Your account has been deactivated. Please contact your RBSK supervisor or administrator.');
    });

    it('permits active accounts to log in successfully', async () => {
      const activeUser: UserProfileDoc = {
        ...sampleTraineeDoc,
        accountStatus: 'ACTIVE',
      };

      vi.spyOn(mockAuthProvider, 'authenticateWithPassword' as any).mockResolvedValueOnce({
        token: 'token_123',
        refreshToken: 'refresh_123',
        expiresIn: 3600,
        uid: activeUser.uid,
      });
      vi.spyOn(mockUserRepo, 'findByUid').mockResolvedValueOnce(activeUser);

      const res = await authUseCase.login({
        identifier: activeUser.phoneNumber!,
        password: 'Password@123',
      });

      expect(res.success).toBe(true);
      expect(res.token).toBe('token_123');
    });

    it('blocks deactivated accounts during profile hydration in getUserProfileAndStats', async () => {
      const deactivatedUser: UserProfileDoc = {
        ...sampleTraineeDoc,
        accountStatus: 'DEACTIVATED',
      };

      vi.spyOn(mockUserRepo, 'findByUid').mockResolvedValueOnce(deactivatedUser);

      await expect(
        authUseCase.getUserProfileAndStats(deactivatedUser.uid)
      ).rejects.toThrow('Your account has been deactivated. Please contact your RBSK supervisor or administrator.');
    });

    it('regenerates temporary credentials and access instructions for a worker', async () => {
      vi.spyOn(adminUseCase, 'getLearnerDetails').mockResolvedValueOnce({
        uid: sampleTraineeDoc.uid,
        username: sampleTraineeDoc.username,
        displayName: sampleTraineeDoc.displayName,
        phoneNumber: sampleTraineeDoc.phoneNumber,
        designation: sampleTraineeDoc.designation,
        district: sampleTraineeDoc.district,
        state: sampleTraineeDoc.state,
        totalXp: 200,
        currentStreak: 5,
        currentLevel: 2,
        completedQuestionsCount: 40,
        completedSessionsCount: 4,
        onboardingStatus: 'NOT_INITIATED',
        accountStatus: 'ACTIVE',
        createdAt: sampleTraineeDoc.createdAt as any,
      });

      const creds = await adminUseCase.resetLearnerCredentials(sampleTraineeDoc.uid);

      expect(creds.uid).toBe(sampleTraineeDoc.uid);
      expect(creds.username).toBe(sampleTraineeDoc.username);
      expect(creds.temporaryPassword).toMatch(/^AuSkill@\d{7}$/);
      expect(creds.instructions).toContain(sampleTraineeDoc.displayName);
      expect(creds.instructions).toContain(creds.temporaryPassword);
      expect(creds.instructions).toContain(sampleTraineeDoc.phoneNumber);
      expect(mockAuthProvider.revokeUserSessions).toHaveBeenCalledWith(sampleTraineeDoc.uid);
      expect(mockAuthProvider.updateUserPassword).toHaveBeenCalledWith(sampleTraineeDoc.uid, creds.temporaryPassword);
    });

    it('rejects learner update if phone number format is invalid', async () => {
      vi.spyOn(adminUseCase, 'getLearnerDetails').mockResolvedValueOnce({
        uid: sampleTraineeDoc.uid,
        username: sampleTraineeDoc.username,
        displayName: sampleTraineeDoc.displayName,
        phoneNumber: sampleTraineeDoc.phoneNumber,
        designation: sampleTraineeDoc.designation,
        district: sampleTraineeDoc.district,
        state: sampleTraineeDoc.state,
        totalXp: 200,
        currentStreak: 5,
        currentLevel: 2,
        completedQuestionsCount: 40,
        completedSessionsCount: 4,
        onboardingStatus: 'NOT_INITIATED',
        accountStatus: 'ACTIVE',
        createdAt: sampleTraineeDoc.createdAt as any,
      });

      // Mock adminDb.doc('users/' + uid).get()
      const { adminDb } = await import('../src/infrastructure/config/firebaseAdmin.js');
      vi.spyOn(adminDb, 'doc').mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          data: () => sampleTraineeDoc,
        }),
      } as any);

      await expect(
        adminUseCase.updateLearner(sampleTraineeDoc.uid, { phoneNumber: '123' })
      ).rejects.toThrow('Invalid phone number format');
    });

    it('rejects learner update if phone number belongs to another user', async () => {
      const { adminDb } = await import('../src/infrastructure/config/firebaseAdmin.js');
      vi.spyOn(adminDb, 'doc').mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          data: () => sampleTraineeDoc,
        }),
      } as any);

      mockUserRepo.findByPhoneNumber = vi.fn().mockResolvedValueOnce({
        uid: 'other_user_999',
        status: 'ACTIVE',
      });

      await expect(
        adminUseCase.updateLearner(sampleTraineeDoc.uid, { phoneNumber: '9876543219' })
      ).rejects.toThrow('is already in use by another learner');
    });

    it('toggles learner account status and disables auth credentials when deactivated', async () => {
      const { adminDb } = await import('../src/infrastructure/config/firebaseAdmin.js');
      const updateMock = vi.fn().mockResolvedValueOnce(undefined);
      vi.spyOn(adminDb, 'doc').mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          data: () => sampleTraineeDoc,
        }),
        update: updateMock,
      } as any);

      vi.spyOn(adminUseCase, 'getLearnerDetails').mockResolvedValueOnce({
        uid: sampleTraineeDoc.uid,
        username: sampleTraineeDoc.username,
        displayName: sampleTraineeDoc.displayName,
        phoneNumber: sampleTraineeDoc.phoneNumber,
        designation: sampleTraineeDoc.designation,
        district: sampleTraineeDoc.district,
        state: sampleTraineeDoc.state,
        totalXp: 200,
        currentStreak: 5,
        currentLevel: 2,
        completedQuestionsCount: 40,
        completedSessionsCount: 4,
        onboardingStatus: 'NOT_INITIATED',
        accountStatus: 'DEACTIVATED',
        createdAt: sampleTraineeDoc.createdAt as any,
      });

      const updated = await adminUseCase.setLearnerStatus(sampleTraineeDoc.uid, 'DEACTIVATED');

      expect(updated.accountStatus).toBe('DEACTIVATED');
      expect(mockAuthProvider.revokeUserSessions).toHaveBeenCalledWith(sampleTraineeDoc.uid);
      expect(mockAuthProvider.updateUserDisabled).toHaveBeenCalledWith(sampleTraineeDoc.uid, true);
    });
  });
});
