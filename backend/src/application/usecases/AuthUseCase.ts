import { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { IAuthProvider, AuthTokens } from '../../domain/interfaces/IAuthProvider.js';
import {
  RegisterRequestDTO,
  LoginRequestDTO,
  AuthResponseDTO,
  RefreshResponseDTO,
  UpdateProfileRequestDTO
} from '../dtos/auth.dto.js';
import {
  normalizeUsername,
  generateSyntheticEmail,
  validatePassword
} from '../../domain/rules/username.js';
import { UserProfileDoc, UserProfile } from '../../domain/models/user.model.js';
import { UserStats } from '../../domain/models/session.model.js';
import { normalizePhoneNumber } from '../../domain/rules/phone.js';

export class RegistrationAuthenticationError extends Error {
  public readonly code = 'REGISTRATION_AUTH_FAILED';
  constructor(
    message: string,
    public readonly uid: string,
    public readonly profile: UserProfile,
    public readonly stats: UserStats,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'RegistrationAuthenticationError';
  }
}

export interface RegisterOptions {
  skipTokenGeneration?: boolean;
}

export class AuthUseCase {
  constructor(
    private userRepo: IUserRepository,
    private authProvider: IAuthProvider
  ) {}

  async register(
    input: RegisterRequestDTO,
    options?: RegisterOptions
  ): Promise<AuthResponseDTO & { refreshToken?: string }> {
    const {
      username,
      password,
      displayName,
      designation,
      district,
      state,
      healthSubCentre,
      optionalEmail,
      phoneNumber,
      onboardingStatus,
    } = input;

    if (!displayName || !displayName.trim()) {
      throw new Error('Full name is required.');
    }
    if (!designation || !designation.trim()) {
      throw new Error('Designation is required.');
    }

    const normUsername = normalizeUsername(username);
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.error || 'Password does not meet requirements.');
    }

    // Phone normalization & validation if provided
    let normPhone: string | null = null;
    if (phoneNumber && phoneNumber.trim()) {
      const phoneCheck = normalizePhoneNumber(phoneNumber);
      if (!phoneCheck.valid) {
        throw new Error(phoneCheck.error || 'Invalid phone number format.');
      }
      normPhone = phoneCheck.normalized;
    }

    const syntheticEmail = generateSyntheticEmail(normUsername);
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let usernameReservationAcquired = false;
    let phoneReservationAcquired = false;
    let createdUid: string | null = null;

    let initialProfile: UserProfile;
    let initialStats: UserStats;

    // =========================================================================
    // PHASE A: PRE-COMMIT REGISTRATION & COMPENSATING ROLLBACK BOUNDARY
    // =========================================================================
    try {
      // 1. Reserve username
      usernameReservationAcquired = await this.userRepo.reserveUsername(normUsername, reservationId);
      if (!usernameReservationAcquired) {
        throw new Error('Username is already taken. Please choose another username.');
      }

      // 2. Reserve phone number atomically if provided
      if (normPhone && typeof this.userRepo.reservePhoneNumber === 'function') {
        phoneReservationAcquired = await this.userRepo.reservePhoneNumber(normPhone, reservationId);
        if (!phoneReservationAcquired) {
          throw new Error(`Learner with phone number '${normPhone}' is already registered.`);
        }
      }

      // 3. Create Firebase Auth user
      const authResult = await this.authProvider.createUser(syntheticEmail, password, displayName.trim());
      createdUid = authResult.uid;

      // 4. Create user profile doc atomically with phoneNumber & onboarding status
      const initialProfileDoc: UserProfileDoc = {
        uid: createdUid,
        username: normUsername,
        syntheticEmail,
        phoneNumber: normPhone || undefined,
        onboardingStatus: onboardingStatus || 'NOT_INITIATED',
        whatsappOnboardedAt: null,
        onboardingError: undefined,
        optionalEmail: optionalEmail?.trim() || '',
        displayName: displayName.trim(),
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: designation.trim(),
        healthSubCentre: healthSubCentre?.trim() || '',
        ...(district && district.trim() ? { district: district.trim() } : {}),
        ...(state && state.trim() ? { state: state.trim() } : {}),
        trainingTimeZone: 'Asia/Kolkata',
        learningState: {
          totalXp: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActiveDate: null,
          completedQuestionsCount: 0,
          completedSessionsCount: 0,
          totalCorrectAnswersCount: 0,
          currentLevel: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userRepo.createUserProfile(initialProfileDoc);

      // 5. Activate username & phone number mapping with ownership verification
      await this.userRepo.activateUsername(normUsername, createdUid, reservationId);
      if (normPhone && typeof this.userRepo.activatePhoneNumber === 'function') {
        await this.userRepo.activatePhoneNumber(normPhone, createdUid, reservationId);
      }

      // Account is now fully created, mapped, and committed
      initialProfile = {
        id: createdUid,
        name: displayName.trim(),
        role: designation.trim(),
        healthSubCentre: healthSubCentre?.trim() || '',
        centerName: healthSubCentre?.trim() || '',
        email: optionalEmail?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      initialStats = {
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
      };

    } catch (err: any) {
      // Compensating Cleanup for PRE-COMMIT failure ONLY
      if (createdUid) {
        if (typeof this.userRepo.deleteUserProfile === 'function') {
          try {
            await this.userRepo.deleteUserProfile(createdUid);
          } catch (cleanupProfileErr) {
            console.warn('Failed to delete user profile during compensating rollback:', cleanupProfileErr);
          }
        }
        try {
          await this.authProvider.deleteUser(createdUid);
        } catch (cleanupErr) {
          console.warn('Failed to delete auth user during compensating cleanup:', cleanupErr);
        }
      }
      if (usernameReservationAcquired) {
        try {
          if (createdUid) {
            await this.userRepo.releaseUsername(normUsername, reservationId, createdUid);
          } else {
            await this.userRepo.releaseUsername(normUsername, reservationId);
          }
        } catch (cleanupErr) {
          console.warn('Failed to release username reservation:', cleanupErr);
        }
      }
      if (phoneReservationAcquired && normPhone && typeof this.userRepo.releasePhoneNumber === 'function') {
        try {
          if (createdUid) {
            await this.userRepo.releasePhoneNumber(normPhone, reservationId, createdUid);
          } else {
            await this.userRepo.releasePhoneNumber(normPhone, reservationId);
          }
        } catch (cleanupErr) {
          console.warn('Failed to release phone reservation:', cleanupErr);
        }
      }
      throw err;
    }

    // =========================================================================
    // PHASE B: POST-COMMIT SESSION CREATION (NON-DESTRUCTIVE)
    // =========================================================================
    // If caller explicitly requested to skip token generation (e.g. Admin onboarding)
    if (options?.skipTokenGeneration) {
      return {
        success: true,
        profile: initialProfile,
        stats: initialStats,
      };
    }

    // Attempt initial sign-in to generate access/refresh tokens
    try {
      const tokens = await this.authProvider.authenticateWithPassword({
        email: syntheticEmail,
        password,
      });

      return {
        success: true,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        profile: initialProfile,
        stats: initialStats,
      };
    } catch (authErr: any) {
      // Post-commit authentication failure:
      // The account is committed and valid. DO NOT delete Auth or Firestore records!
      throw new RegistrationAuthenticationError(
        'Learner account registered successfully, but automatic session creation failed. Please sign in with your credentials.',
        createdUid,
        initialProfile,
        initialStats,
        authErr
      );
    }
  }

  async login(input: LoginRequestDTO): Promise<AuthResponseDTO & { refreshToken: string }> {
    const { identifier, password } = input;
    if (!identifier || !identifier.trim()) {
      throw new Error('Please enter your username, email, or phone number.');
    }
    if (!password || !password.trim()) {
      throw new Error('Please enter your password.');
    }

    const trimmedIdentifier = identifier.trim();
    let authEmail = trimmedIdentifier;

    // Map phone number or username to synthetic email if no @ present
    if (!trimmedIdentifier.includes('@')) {
      let resolvedByPhone = false;
      const phoneCheck = normalizePhoneNumber(trimmedIdentifier);
      if (phoneCheck.valid && typeof this.userRepo.findByPhoneNumber === 'function') {
        try {
          const phoneRecord = await this.userRepo.findByPhoneNumber(phoneCheck.normalized);
          if (phoneRecord && phoneRecord.uid) {
            const profile = await this.userRepo.findByUid(phoneRecord.uid);
            if (profile && profile.syntheticEmail) {
              authEmail = profile.syntheticEmail;
              resolvedByPhone = true;
            }
          }
        } catch {
          // Fall through to standard username resolution
        }
      }

      if (!resolvedByPhone) {
        try {
          const norm = normalizeUsername(trimmedIdentifier);
          authEmail = generateSyntheticEmail(norm);
        } catch {
          const clean = trimmedIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
          authEmail = generateSyntheticEmail(clean || 'trainee');
        }
      }
    }

    // 1. Authenticate with Identity Toolkit
    let tokens: AuthTokens;
    try {
      tokens = await this.authProvider.authenticateWithPassword({
        email: authEmail,
        password
      });
    } catch {
      throw new Error('Invalid credentials. Please verify your username and password.');
    }

    if (!tokens || !tokens.uid) {
      throw new Error('Invalid credentials. Please verify your username and password.');
    }

    // 2. Hydrate user profile from Firestore
    let profileDoc = await this.userRepo.findByUid(tokens.uid);

    if (profileDoc && profileDoc.accountStatus === 'DEACTIVATED') {
      throw new Error('Your account has been deactivated. Please contact your RBSK supervisor or administrator.');
    }

    const profile: UserProfile = {
      id: tokens.uid,
      name: profileDoc?.displayName || 'Frontline Trainee',
      role: profileDoc?.designation || profileDoc?.role || 'ASHA_WORKER',
      systemRole: profileDoc?.role || 'TRAINEE',
      healthSubCentre: profileDoc?.healthSubCentre || '',
      centerName: profileDoc?.healthSubCentre || '',
      email: profileDoc?.optionalEmail || authEmail,
      createdAt: typeof profileDoc?.createdAt?.toDate === 'function'
        ? profileDoc.createdAt.toDate().toISOString()
        : new Date().toISOString(),
    };

    const stats: UserStats = {
      totalXp: profileDoc?.learningState?.totalXp ?? 0,
      currentStreak: profileDoc?.learningState?.currentStreak ?? 0,
      longestStreak: profileDoc?.learningState?.longestStreak ?? profileDoc?.learningState?.currentStreak ?? 0,
      lastActiveDate: profileDoc?.learningState?.lastActiveDate ?? null,
      completedQuestionsCount: profileDoc?.learningState?.completedQuestionsCount ?? 0,
      completedSessionsCount: profileDoc?.learningState?.completedSessionsCount ?? 0,
      totalCorrectAnswersCount: profileDoc?.learningState?.totalCorrectAnswersCount ?? 0,
    };

    return {
      success: true,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      profile,
      stats,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResponseDTO & { refreshToken: string }> {
    if (!refreshToken) {
      throw new Error('No refresh token provided.');
    }
    const tokens = await this.authProvider.refreshToken(refreshToken);
    return {
      success: true,
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  async logout(uid: string, allDevices: boolean = false): Promise<void> {
    if (allDevices && uid) {
      await this.authProvider.revokeUserSessions(uid);
    }
  }

  async forgotPassword(identifier: string): Promise<string> {
    if (!identifier || !identifier.trim()) {
      throw new Error('Identifier is required.');
    }
    let email = identifier.trim();
    if (!email.includes('@')) {
      const norm = normalizeUsername(email);
      email = generateSyntheticEmail(norm);
    }
    return this.authProvider.generatePasswordResetLink(email);
  }

  async getUserProfileAndStats(uid: string): Promise<{ profile: UserProfile; stats: UserStats }> {
    const doc = await this.userRepo.findByUid(uid);
    if (!doc) {
      throw new Error(`User ${uid} not found.`);
    }

    if (doc.accountStatus === 'DEACTIVATED') {
      throw new Error('Your account has been deactivated. Please contact your RBSK supervisor or administrator.');
    }

    const profile: UserProfile = {
      id: uid,
      name: doc.displayName,
      role: doc.designation || doc.role,
      systemRole: doc.role || 'TRAINEE',
      healthSubCentre: doc.healthSubCentre,
      centerName: doc.healthSubCentre,
      email: doc.optionalEmail,
      createdAt: typeof doc.createdAt?.toDate === 'function' ? doc.createdAt.toDate().toISOString() : undefined,
    };

    const stats: UserStats = {
      totalXp: doc.learningState.totalXp,
      currentStreak: doc.learningState.currentStreak,
      longestStreak: doc.learningState.longestStreak,
      lastActiveDate: doc.learningState.lastActiveDate,
      completedQuestionsCount: doc.learningState.completedQuestionsCount,
      completedSessionsCount: doc.learningState.completedSessionsCount,
      totalCorrectAnswersCount: doc.learningState.totalCorrectAnswersCount,
    };

    return { profile, stats };
  }

  async updateProfile(uid: string, input: UpdateProfileRequestDTO): Promise<UserProfile> {
    if (!uid || !uid.trim()) {
      throw new Error('User ID is required.');
    }

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Invalid update payload.');
    }

    // Explicit allow-list of user-editable profile fields
    const sanitizedUpdates: Partial<UserProfileDoc> = {};

    if (input.displayName !== undefined) {
      if (typeof input.displayName !== 'string' || !input.displayName.trim()) {
        throw new Error('Display name must be a non-empty string.');
      }
      sanitizedUpdates.displayName = input.displayName.trim();
    }

    if (input.designation !== undefined) {
      if (typeof input.designation !== 'string' || !input.designation.trim()) {
        throw new Error('Designation must be a non-empty string.');
      }
      sanitizedUpdates.designation = input.designation.trim();
    }

    if (input.healthSubCentre !== undefined) {
      if (typeof input.healthSubCentre !== 'string') {
        throw new Error('Health sub-centre must be a string.');
      }
      sanitizedUpdates.healthSubCentre = input.healthSubCentre.trim();
    }

    if (input.optionalEmail !== undefined) {
      if (typeof input.optionalEmail !== 'string') {
        throw new Error('Optional email must be a string.');
      }
      const trimmedEmail = input.optionalEmail.trim();
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error('Optional email format is invalid.');
      }
      sanitizedUpdates.optionalEmail = trimmedEmail;
    }

    // Only invoke persistence update if allow-listed fields were provided
    if (Object.keys(sanitizedUpdates).length > 0) {
      await this.userRepo.updateUserProfile(uid, sanitizedUpdates);
    }

    const refreshed = await this.userRepo.findByUid(uid);
    if (!refreshed) throw new Error('User not found after update');

    return {
      id: uid,
      name: refreshed.displayName,
      role: refreshed.designation || refreshed.role,
      healthSubCentre: refreshed.healthSubCentre,
      centerName: refreshed.healthSubCentre,
      email: refreshed.optionalEmail,
    };
  }
}
