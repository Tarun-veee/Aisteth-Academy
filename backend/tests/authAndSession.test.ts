import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthUseCase } from '../src/application/usecases/AuthUseCase.js';
import { SessionUseCase } from '../src/application/usecases/SessionUseCase.js';
import { IUserRepository } from '../src/domain/interfaces/IUserRepository.js';
import { ISessionRepository } from '../src/domain/interfaces/ISessionRepository.js';
import { IAuthProvider } from '../src/domain/interfaces/IAuthProvider.js';
import { UserProfileDoc } from '../src/domain/models/user.model.js';

describe('Backend Auth & Session Comprehensive Verification Matrix', () => {
  let mockUserRepo: IUserRepository;
  let mockSessionRepo: ISessionRepository;
  let mockAuthProvider: IAuthProvider;
  let authUseCase: AuthUseCase;
  let sessionUseCase: SessionUseCase;

  const sampleProfileDoc: UserProfileDoc = {
    uid: 'trainee_test_123',
    username: 'sunita.patil',
    syntheticEmail: 'sunita.patil@trainee.aisteth.app',
    displayName: 'Dr. Sunita Patil',
    designation: 'Medical Officer',
    healthSubCentre: 'PHC Wardha',
    district: 'Wardha',
    state: 'Maharashtra',
    optionalEmail: 'sunita.patil@aisteth.app',
    createdAt: new Date().toISOString(),
    learningState: {
      totalXp: 100,
      currentStreak: 5,
      longestStreak: 5,
      completedSessionsCount: 5,
      completedQuestionsCount: 50,
      totalCorrectAnswersCount: 40,
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
      authenticateWithPassword: vi.fn(),
      verifyIdToken: vi.fn(),
      refreshToken: vi.fn(),
      revokeUserSessions: vi.fn(),
      deleteUser: vi.fn(),
      generatePasswordResetLink: vi.fn(),
    };

    mockSessionRepo = {
      getDailySession: vi.fn(),
      createDailySession: vi.fn(),
      appendAttempt: vi.fn(),
      updateSessionProgress: vi.fn(),
      recordAttemptAtomic: vi.fn(),
      finalizeSessionAtomic: vi.fn(),
    };

    authUseCase = new AuthUseCase(mockUserRepo, mockAuthProvider);
    sessionUseCase = new SessionUseCase(mockSessionRepo, mockUserRepo);
  });

  // =========================================================================
  // 1. REGISTRATION & VALIDATION
  // =========================================================================
  describe('Registration & Input Validation', () => {
    it('successfully registers trainee with valid payload and reserves username', async () => {
      vi.mocked(mockUserRepo.reserveUsername).mockResolvedValue(true);
      vi.mocked(mockAuthProvider.createUser).mockResolvedValue({ uid: 'new_uid_999' });
      vi.mocked(mockAuthProvider.authenticateWithPassword).mockResolvedValue({
        token: 'mock_jwt_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 3600,
        uid: 'new_uid_999',
      });
      vi.mocked(mockUserRepo.createUserProfile).mockResolvedValue();
      vi.mocked(mockUserRepo.activateUsername).mockResolvedValue();

      const result = await authUseCase.register({
        username: 'sunita.patil',
        password: 'Password123!',
        displayName: 'Dr. Sunita Patil',
        designation: 'Medical Officer',
        district: 'Wardha',
        state: 'Maharashtra',
        healthSubCentre: 'PHC Wardha',
      });

      expect(result.success).toBe(true);
      expect(result.profile?.name).toBe('Dr. Sunita Patil');
      expect(result.token).toBe('mock_jwt_token');
      expect(result.refreshToken).toBe('mock_refresh_token');
    });

    it('rejects registration if username is already taken and compensates', async () => {
      vi.mocked(mockUserRepo.reserveUsername).mockResolvedValue(false);

      await expect(
        authUseCase.register({
          username: 'existing.user',
          password: 'Password123!',
          displayName: 'Duplicate User',
          designation: 'ANM',
          district: 'Pune',
          state: 'Maharashtra',
        })
      ).rejects.toThrow('Username is already taken');
    });

    it('compensates and releases reserved username if Auth Provider user creation fails', async () => {
      vi.mocked(mockUserRepo.reserveUsername).mockResolvedValue(true);
      vi.mocked(mockAuthProvider.createUser).mockRejectedValue(new Error('AUTH_PROVIDER_DOWN'));

      await expect(
        authUseCase.register({
          username: 'test.rollback',
          password: 'Password123!',
          displayName: 'Test Rollback',
          designation: 'ASHA',
          district: 'Nagpur',
          state: 'Maharashtra',
        })
      ).rejects.toThrow('AUTH_PROVIDER_DOWN');

      expect(mockUserRepo.releaseUsername).toHaveBeenCalledWith(
        'test.rollback',
        expect.any(String)
      );
    });
  });

  // =========================================================================
  // 2. LOGIN & CREDENTIAL VERIFICATION
  // =========================================================================
  describe('Login & Credential Verification', () => {
    it('verifies password credentials via Auth Provider and returns profile + token pair', async () => {
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
        uid: sampleProfileDoc.uid,
        status: 'ACTIVE',
      });
      vi.mocked(mockUserRepo.findByUid).mockResolvedValue(sampleProfileDoc);
      vi.mocked(mockAuthProvider.authenticateWithPassword).mockResolvedValue({
        token: 'mock_access_token_123',
        refreshToken: 'mock_refresh_cookie_token',
        expiresIn: 3600,
        uid: sampleProfileDoc.uid,
      });

      const result = await authUseCase.login({
        identifier: 'sunita.patil',
        password: 'Password123!',
      });

      expect(result.success).toBe(true);
      expect(result.profile.id).toBe(sampleProfileDoc.uid);
      expect(result.token).toBe('mock_access_token_123');
      expect(result.refreshToken).toBe('mock_refresh_cookie_token');
    });

    it('rejects invalid password with authentication error', async () => {
      vi.mocked(mockUserRepo.findByUsername).mockResolvedValue({
        uid: sampleProfileDoc.uid,
        status: 'ACTIVE',
      });
      vi.mocked(mockAuthProvider.authenticateWithPassword).mockRejectedValue(new Error('INVALID_LOGIN_CREDENTIALS'));

      await expect(
        authUseCase.login({
          identifier: 'sunita.patil',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('rejects nonexistent user login attempt', async () => {
      vi.mocked(mockAuthProvider.authenticateWithPassword).mockRejectedValue(
        new Error('EMAIL_NOT_FOUND')
      );

      await expect(
        authUseCase.login({
          identifier: 'nonexistent.user',
          password: 'Password123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  // =========================================================================
  // 3. REFRESH TOKEN FLOW
  // =========================================================================
  describe('Token Refresh Flow', () => {
    it('refreshes token pair when valid refreshToken is provided', async () => {
      vi.mocked(mockAuthProvider.refreshToken).mockResolvedValue({
        token: 'new_fresh_id_token',
        refreshToken: 'new_rotated_refresh_token',
        expiresIn: 3600,
        uid: 'uid_test',
      });

      const result = await authUseCase.refresh('valid_refresh_cookie_value');
      expect(result.token).toBe('new_fresh_id_token');
      expect(result.refreshToken).toBe('new_rotated_refresh_token');
    });

    it('throws error when refresh token is invalid or expired', async () => {
      vi.mocked(mockAuthProvider.refreshToken).mockRejectedValue(new Error('TOKEN_EXPIRED'));

      await expect(authUseCase.refresh('expired_cookie_token')).rejects.toThrow('TOKEN_EXPIRED');
    });
  });

  // =========================================================================
  // 4. LOGOUT SEMANTICS (SINGLE-DEVICE VS GLOBAL)
  // =========================================================================
  describe('Logout Semantics', () => {
    it('single-device logout does NOT revoke global tokens on Auth Provider', async () => {
      await authUseCase.logout('uid_test_123', false);
      expect(mockAuthProvider.revokeUserSessions).not.toHaveBeenCalled();
    });

    it('global logout (?allDevices=true) calls revokeUserSessions on Auth Provider', async () => {
      await authUseCase.logout('uid_test_123', true);
      expect(mockAuthProvider.revokeUserSessions).toHaveBeenCalledWith('uid_test_123');
    });
  });

  // =========================================================================
  // 5. SESSION FINALIZATION & ATOMICITY
  // =========================================================================
  describe('Session Finalization Atomicity & Idempotency', () => {
    it('finalizes session and increments learning state atomically on first call', async () => {
      vi.mocked(mockSessionRepo.finalizeSessionAtomic).mockResolvedValue({
        success: true,
        alreadyFinalized: false,
        updatedLearningState: {
          totalXp: 150,
          currentStreak: 6,
          longestStreak: 6,
          lastActiveDate: '2026-10-08',
          completedSessionsCount: 6,
          completedQuestionsCount: 60,
          totalCorrectAnswersCount: 48,
          currentLevel: 2,
        },
      });

      const res = await sessionUseCase.finalizeSession('trainee_test_123', {
        sessionId: 'daily_2026-10-08_trainee_',
        totalXpEarned: 50,
        correctCount: 8,
        totalQuestions: 10,
      });

      expect(res.success).toBe(true);
      expect(res.alreadyFinalized).toBe(false);
      expect(res.updatedStats?.totalXp).toBe(150);
      expect(mockSessionRepo.finalizeSessionAtomic).toHaveBeenCalledWith({
        uid: 'trainee_test_123',
        sessionId: 'daily_2026-10-08_trainee_',
        todayDateStr: expect.any(String),
      });
    });

    it('safely handles already finalized session without duplicate awards', async () => {
      vi.mocked(mockSessionRepo.finalizeSessionAtomic).mockResolvedValue({
        success: true,
        alreadyFinalized: true,
      });

      const res = await sessionUseCase.finalizeSession('trainee_test_123', {
        sessionId: 'daily_2026-10-08_trainee_',
        totalXpEarned: 50,
        correctCount: 8,
        totalQuestions: 10,
      });

      expect(res.success).toBe(true);
      expect(res.alreadyFinalized).toBe(true);
    });
  });
});
