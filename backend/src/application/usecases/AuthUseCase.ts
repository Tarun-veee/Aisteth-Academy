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

export class AuthUseCase {
  constructor(
    private userRepo: IUserRepository,
    private authProvider: IAuthProvider
  ) {}

  async register(input: RegisterRequestDTO): Promise<AuthResponseDTO & { refreshToken: string }> {
    const { username, password, displayName, designation, district, state, healthSubCentre, optionalEmail } = input;

    if (!displayName || !displayName.trim()) {
      throw new Error('Full name is required.');
    }
    if (!designation || !designation.trim()) {
      throw new Error('Designation is required.');
    }
    if (!state || !state.trim()) {
      throw new Error('State is required.');
    }
    if (!district || !district.trim()) {
      throw new Error('District is required.');
    }

    const normUsername = normalizeUsername(username);
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.error || 'Password does not meet requirements.');
    }

    const syntheticEmail = generateSyntheticEmail(normUsername);
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let reservationAcquired = false;
    let createdUid: string | null = null;

    try {
      // 1. Reserve username
      reservationAcquired = await this.userRepo.reserveUsername(normUsername, reservationId);
      if (!reservationAcquired) {
        throw new Error('Username is already taken. Please choose another username.');
      }

      // 2. Create Firebase Auth user
      const authResult = await this.authProvider.createUser(syntheticEmail, password, displayName.trim());
      createdUid = authResult.uid;

      // 3. Activate username
      await this.userRepo.activateUsername(normUsername, createdUid);

      // 4. Create user profile doc
      const initialProfileDoc: UserProfileDoc = {
        uid: createdUid,
        username: normUsername,
        syntheticEmail,
        optionalEmail: optionalEmail?.trim() || '',
        displayName: displayName.trim(),
        role: 'TRAINEE',
        organizationId: 'org_rbsk_national',
        designation: designation.trim(),
        healthSubCentre: healthSubCentre?.trim() || '',
        district: district.trim(),
        state: state.trim(),
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
          streakShieldActive: false,
          streakShieldConsumed: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userRepo.createUserProfile(initialProfileDoc);

      // 5. Authenticate to obtain initial session tokens
      const tokens = await this.authProvider.authenticateWithPassword({
        email: syntheticEmail,
        password
      });

      const profile: UserProfile = {
        id: createdUid,
        name: displayName.trim(),
        role: designation.trim(),
        healthSubCentre: healthSubCentre?.trim() || '',
        centerName: healthSubCentre?.trim() || '',
        district: district.trim(),
        state: state.trim(),
        email: optionalEmail?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      const stats: UserStats = {
        totalXp: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
        streakShieldConsumed: false,
      };

      return {
        success: true,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        profile,
        stats,
      };
    } catch (err: any) {
      // Compensating Cleanup
      if (createdUid) {
        await this.authProvider.deleteUser(createdUid);
      }
      if (reservationAcquired) {
        await this.userRepo.releaseUsername(normUsername, reservationId);
      }
      throw err;
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

    // Map username to synthetic email if no @ present
    if (!trimmedIdentifier.includes('@')) {
      try {
        const norm = normalizeUsername(trimmedIdentifier);
        authEmail = generateSyntheticEmail(norm);
      } catch {
        const clean = trimmedIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '');
        authEmail = generateSyntheticEmail(clean || 'trainee');
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

    const profile: UserProfile = {
      id: tokens.uid,
      name: profileDoc?.displayName || 'Frontline Trainee',
      role: profileDoc?.designation || profileDoc?.role || 'ASHA_WORKER',
      healthSubCentre: profileDoc?.healthSubCentre || '',
      centerName: profileDoc?.healthSubCentre || '',
      district: profileDoc?.district || '',
      state: profileDoc?.state || '',
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
      streakShieldConsumed: profileDoc?.learningState?.streakShieldConsumed ?? false,
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

    const profile: UserProfile = {
      id: uid,
      name: doc.displayName,
      role: doc.designation || doc.role,
      healthSubCentre: doc.healthSubCentre,
      centerName: doc.healthSubCentre,
      district: doc.district,
      state: doc.state,
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
      streakShieldConsumed: doc.learningState.streakShieldConsumed,
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

    if (input.district !== undefined) {
      if (typeof input.district !== 'string' || !input.district.trim()) {
        throw new Error('District must be a non-empty string.');
      }
      sanitizedUpdates.district = input.district.trim();
    }

    if (input.state !== undefined) {
      if (typeof input.state !== 'string' || !input.state.trim()) {
        throw new Error('State must be a non-empty string.');
      }
      sanitizedUpdates.state = input.state.trim();
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
      district: refreshed.district,
      state: refreshed.state,
      email: refreshed.optionalEmail,
    };
  }
}
