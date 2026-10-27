import { adminDb } from '../../infrastructure/config/firebaseAdmin.js';
import { AuthUseCase } from './AuthUseCase.js';
import { defaultUserRepository } from '../../infrastructure/firestore/FirestoreUserRepository.js';
import { defaultAuthProvider } from '../../infrastructure/auth/FirebaseAuthAdapter.js';
import { defaultWhatsAppService, WhatsAppOnboardingService } from '../../infrastructure/external/WhatsAppOnboardingService.js';
import { IUserRepository } from '../../domain/interfaces/IUserRepository.js';
import { IAuthProvider } from '../../domain/interfaces/IAuthProvider.js';
import {
  AdminOverviewStats,
  ListLearnersQuery,
  ListLearnersResult,
  LearnerSummaryItem,
  SingleLearnerInput,
  BulkLearnerRowInput,
  BulkImportResult,
  BulkImportItemResult,
  WhatsAppOnboardingResult,
  OnboardingStatus,
  AccountStatus,
  UpdateLearnerInput,
  ResetCredentialsResult
} from '../../domain/models/admin.types.js';
import { normalizeUsername, validatePassword } from '../../domain/rules/username.js';
import { getResolvedCalendarDate } from '../../domain/rules/sessionSelection.js';

export class AdminLearnerUseCase {
  constructor(
    private authUseCase: AuthUseCase = new AuthUseCase(defaultUserRepository, defaultAuthProvider),
    private whatsappService: WhatsAppOnboardingService = defaultWhatsAppService,
    private userRepo: IUserRepository = defaultUserRepository,
    private authProvider: IAuthProvider = defaultAuthProvider
  ) {}

  /**
   * Retrieves high-level learner statistics from Firestore.
   */
  async getOverviewStats(): Promise<AdminOverviewStats> {
    const snapshot = await adminDb
      .collection('users')
      .where('role', '==', 'TRAINEE')
      .get();

    const totalLearners = snapshot.size;
    let activeLearners = 0;
    let pendingOnboarding = 0;
    let failedOnboarding = 0;
    let deactivatedLearners = 0;

    const todayStr = getResolvedCalendarDate();
    const todayMs = new Date(`${todayStr}T09:00:00.000+05:30`).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const lastActive = data?.learningState?.lastActiveDate;
      const streak = data?.learningState?.currentStreak ?? 0;

      if (data?.accountStatus === 'DEACTIVATED') {
        deactivatedLearners++;
      }

      // Active: has a positive streak or active within the past 7 daily cycles
      if (streak > 0) {
        activeLearners++;
      } else if (lastActive) {
        const lastActiveMs = new Date(`${lastActive}T09:00:00.000+05:30`).getTime();
        if (todayMs - lastActiveMs <= sevenDaysMs) {
          activeLearners++;
        }
      }

      const status = (data?.onboardingStatus as OnboardingStatus) || 'NOT_INITIATED';
      if (status === 'NOT_INITIATED' || status === 'QUEUED') {
        pendingOnboarding++;
      } else if (status === 'FAILED') {
        failedOnboarding++;
      }
    }

    return {
      totalLearners,
      activeLearners,
      pendingOnboarding,
      failedOnboarding,
      deactivatedLearners,
    };
  }

  /**
   * Lists learners with search and pagination.
   */
  async listLearners(query: ListLearnersQuery): Promise<ListLearnersResult> {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
    const search = (query.search || '').trim().toLowerCase();
    const statusFilter = query.status || 'ALL';
    const accountStatusFilter = query.accountStatus || 'ALL';

    const snapshot = await adminDb
      .collection('users')
      .where('role', '==', 'TRAINEE')
      .get();

    let allLearners: LearnerSummaryItem[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const item: LearnerSummaryItem = {
        uid: doc.id,
        username: data.username || '',
        displayName: data.displayName || '',
        phoneNumber: data.phoneNumber || undefined,
        designation: data.designation || '',
        healthSubCentre: data.healthSubCentre || undefined,
        ...(data.district ? { district: data.district } : {}),
        ...(data.state ? { state: data.state } : {}),
        totalXp: data.learningState?.totalXp ?? data.totalXp ?? 0,
        currentStreak: data.learningState?.currentStreak ?? 0,
        currentLevel: data.learningState?.currentLevel ?? 1,
        completedQuestionsCount: data.learningState?.completedQuestionsCount ?? 0,
        completedSessionsCount: data.learningState?.completedSessionsCount ?? 0,
        onboardingStatus: (data.onboardingStatus as OnboardingStatus) || 'NOT_INITIATED',
        accountStatus: (data.accountStatus as AccountStatus) || 'ACTIVE',
        whatsappOnboardedAt: typeof data.whatsappOnboardedAt?.toDate === 'function'
          ? data.whatsappOnboardedAt.toDate().toISOString()
          : data.whatsappOnboardedAt || null,
        onboardingError: data.onboardingError || null,
        createdAt: typeof data.createdAt?.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
      };

      // Filter by Onboarding Status
      if (statusFilter !== 'ALL' && item.onboardingStatus !== statusFilter) {
        continue;
      }

      // Filter by Account Status (ACTIVE, DEACTIVATED)
      if (accountStatusFilter !== 'ALL' && item.accountStatus !== accountStatusFilter) {
        continue;
      }

      // Filter by Search Query (Name, Username, Phone Number)
      if (search) {
        const nameMatch = item.displayName.toLowerCase().includes(search);
        const userMatch = item.username.toLowerCase().includes(search);
        const phoneMatch = item.phoneNumber ? item.phoneNumber.includes(search) : false;
        if (!nameMatch && !userMatch && !phoneMatch) {
          continue;
        }
      }

      allLearners.push(item);
    }

    // Sort by createdAt descending
    allLearners.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = allLearners.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedLearners = allLearners.slice(offset, offset + limit);

    return {
      learners: paginatedLearners,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Retrieves single learner details.
   */
  async getLearnerDetails(uid: string): Promise<LearnerSummaryItem | null> {
    const userSnap = await adminDb.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return null;
    }
    const data = userSnap.data()!;
    return {
      uid,
      username: data.username || '',
      displayName: data.displayName || '',
      phoneNumber: data.phoneNumber || undefined,
      designation: data.designation || '',
      healthSubCentre: data.healthSubCentre || undefined,
      ...(data.district ? { district: data.district } : {}),
      ...(data.state ? { state: data.state } : {}),
      totalXp: data.learningState?.totalXp ?? data.totalXp ?? 0,
      currentStreak: data.learningState?.currentStreak ?? 0,
      currentLevel: data.learningState?.currentLevel ?? 1,
      completedQuestionsCount: data.learningState?.completedQuestionsCount ?? 0,
      completedSessionsCount: data.learningState?.completedSessionsCount ?? 0,
      onboardingStatus: (data.onboardingStatus as OnboardingStatus) || 'NOT_INITIATED',
      accountStatus: (data.accountStatus as AccountStatus) || 'ACTIVE',
      whatsappOnboardedAt: typeof data.whatsappOnboardedAt?.toDate === 'function'
        ? data.whatsappOnboardedAt.toDate().toISOString()
        : data.whatsappOnboardedAt || null,
      onboardingError: data.onboardingError || null,
      createdAt: typeof data.createdAt?.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()),
    };
  }

  /**
   * Registers a single learner, validates phone, and initializes onboarding state.
   */
  async registerSingleLearner(input: SingleLearnerInput): Promise<LearnerSummaryItem> {
    const displayName = (input.displayName || '').trim();
    if (!displayName) {
      throw new Error('Learner full name is required.');
    }

    const designation = (input.designation || '').trim();
    if (!designation) {
      throw new Error('Designation (e.g. ASHA_WORKER, ANM) is required.');
    }

    // Phone validation & normalization
    const phoneCheck = this.whatsappService.normalizePhoneNumber(input.phoneNumber);
    if (!phoneCheck.valid) {
      throw new Error(phoneCheck.error || 'Invalid phone number format.');
    }
    const normalizedPhone = phoneCheck.normalized;

    // Check for duplicate phone number
    if (typeof this.userRepo.findByPhoneNumber === 'function') {
      const existingPhone = await this.userRepo.findByPhoneNumber(normalizedPhone);
      if (existingPhone && existingPhone.status === 'ACTIVE') {
        throw new Error(`A learner with phone number ${normalizedPhone} is already registered.`);
      }
    } else {
      const duplicatePhoneSnap = await adminDb
        .collection('users')
        .where('phoneNumber', '==', normalizedPhone)
        .limit(1)
        .get();

      if (!duplicatePhoneSnap.empty) {
        throw new Error(`A learner with phone number ${normalizedPhone} is already registered.`);
      }
    }

    // Determine or generate username
    let targetUsername: string;
    if (input.username && input.username.trim()) {
      targetUsername = normalizeUsername(input.username.trim());
    } else {
      // Auto-generate clean username from phone: asha_<last10digits>
      const digits = normalizedPhone.replace(/\D/g, '').slice(-10);
      targetUsername = `trainee_${digits}`;
    }

    // Check if username is already taken
    const existingUserSnap = await this.userRepo.findByUsername(targetUsername);
    if (existingUserSnap && existingUserSnap.status === 'ACTIVE') {
      throw new Error(`Username '@${targetUsername}' is already taken.`);
    }

    // Password: provided or default initial password
    let password = input.password?.trim();
    if (!password) {
      password = `Welcome@${normalizedPhone.slice(-4)}`;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      throw new Error(pwdCheck.error || 'Password does not meet requirements.');
    }

    // Register account via existing AuthUseCase (atomic profile + phone reservation)
    // Administrator onboarding discards tokens; skipTokenGeneration avoids unnecessary token dependency
    const authResult = await this.authUseCase.register({
      username: targetUsername,
      password,
      displayName,
      designation,
      healthSubCentre: input.healthSubCentre?.trim() || '',
      optionalEmail: input.optionalEmail?.trim() || '',
      phoneNumber: normalizedPhone,
      onboardingStatus: 'NOT_INITIATED',
    }, { skipTokenGeneration: true });

    const uid = authResult.profile.id;

    return {
      uid,
      username: targetUsername,
      displayName,
      phoneNumber: normalizedPhone,
      designation,
      healthSubCentre: input.healthSubCentre?.trim() || undefined,
      totalXp: 0,
      currentStreak: 0,
      currentLevel: 1,
      completedQuestionsCount: 0,
      completedSessionsCount: 0,
      onboardingStatus: 'NOT_INITIATED',
      accountStatus: 'ACTIVE',
      whatsappOnboardedAt: null,
      onboardingError: null,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Bulk import learners from CSV rows with safety and duplicate prevention.
   */
  async bulkImportLearners(rows: BulkLearnerRowInput[]): Promise<BulkImportResult> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('CSV import data is empty or invalid.');
    }

    const results: BulkImportItemResult[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Track seen phone numbers and usernames within the same import file to prevent intra-batch collisions
    const seenPhonesInBatch = new Set<string>();
    const seenUsernamesInBatch = new Set<string>();

    for (let index = 0; index < rows.length; index++) {
      const rowNumber = index + 1;
      const row = rows[index];
      const displayName = (row.displayName || '').trim();
      const rawPhone = (row.phoneNumber || '').trim();

      if (!displayName || !rawPhone) {
        failedCount++;
        results.push({
          rowNumber,
          displayName: displayName || 'Missing Name',
          phoneNumber: rawPhone || 'Missing Phone',
          username: '',
          status: 'FAILED',
          error: 'Required fields missing: Full Name and Phone Number are mandatory.',
        });
        continue;
      }

      // Validate & normalize phone
      const phoneCheck = this.whatsappService.normalizePhoneNumber(rawPhone);
      if (!phoneCheck.valid) {
        failedCount++;
        results.push({
          rowNumber,
          displayName,
          phoneNumber: rawPhone,
          username: '',
          status: 'FAILED',
          error: phoneCheck.error || 'Invalid phone number format.',
        });
        continue;
      }
      const normalizedPhone = phoneCheck.normalized;

      // Check intra-batch duplicate phone
      if (seenPhonesInBatch.has(normalizedPhone)) {
        skippedCount++;
        results.push({
          rowNumber,
          displayName,
          phoneNumber: normalizedPhone,
          username: '',
          status: 'SKIPPED_DUPLICATE',
          error: 'Duplicate phone number within the same CSV import file.',
        });
        continue;
      }
      seenPhonesInBatch.add(normalizedPhone);

      // Determine username
      let targetUsername: string;
      if (row.username && row.username.trim()) {
        try {
          targetUsername = normalizeUsername(row.username.trim());
        } catch (err: any) {
          failedCount++;
          results.push({
            rowNumber,
            displayName,
            phoneNumber: normalizedPhone,
            username: row.username,
            status: 'FAILED',
            error: err?.message || 'Invalid username format.',
          });
          continue;
        }
      } else {
        const digits = normalizedPhone.replace(/\D/g, '').slice(-10);
        targetUsername = `trainee_${digits}`;
      }

      // Check intra-batch duplicate username
      if (seenUsernamesInBatch.has(targetUsername)) {
        skippedCount++;
        results.push({
          rowNumber,
          displayName,
          phoneNumber: normalizedPhone,
          username: targetUsername,
          status: 'SKIPPED_DUPLICATE',
          error: `Username '@${targetUsername}' appears multiple times in the import file.`,
        });
        continue;
      }
      seenUsernamesInBatch.add(targetUsername);

      // Attempt single learner registration
      try {
        const registered = await this.registerSingleLearner({
          displayName,
          phoneNumber: normalizedPhone,
          username: targetUsername,
          designation: row.designation?.trim() || 'ASHA_WORKER',
          healthSubCentre: row.healthSubCentre?.trim() || '',
          optionalEmail: row.optionalEmail?.trim() || '',
          password: row.password?.trim() || undefined,
        });

        successCount++;
        results.push({
          rowNumber,
          displayName,
          phoneNumber: normalizedPhone,
          username: registered.username,
          status: 'SUCCESS',
          uid: registered.uid,
        });
      } catch (err: any) {
        const errorMsg = err?.message || 'Registration failed';
        if (errorMsg.includes('already registered') || errorMsg.includes('already taken')) {
          skippedCount++;
          results.push({
            rowNumber,
            displayName,
            phoneNumber: normalizedPhone,
            username: targetUsername,
            status: 'SKIPPED_DUPLICATE',
            error: errorMsg,
          });
        } else {
          failedCount++;
          results.push({
            rowNumber,
            displayName,
            phoneNumber: normalizedPhone,
            username: targetUsername,
            status: 'FAILED',
            error: errorMsg,
          });
        }
      }
    }

    return {
      totalRows: rows.length,
      successCount,
      skippedCount,
      failedCount,
      results,
    };
  }

  /**
   * Initiates WhatsApp onboarding for an eligible learner.
   */
  async triggerWhatsAppOnboarding(uid: string): Promise<WhatsAppOnboardingResult> {
    const userSnap = await adminDb.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      throw new Error(`Learner '${uid}' not found.`);
    }

    const userData = userSnap.data()!;
    const phoneNumber = userData.phoneNumber;
    if (!phoneNumber) {
      throw new Error(`Learner '${userData.displayName || uid}' does not have a registered phone number.`);
    }

    // Set status to QUEUED
    await adminDb.doc(`users/${uid}`).update({
      onboardingStatus: 'QUEUED',
      onboardingError: null,
      updatedAt: new Date(),
    });

    const result = await this.whatsappService.sendOnboardingMessage({
      uid,
      phoneNumber,
      learnerName: userData.displayName || 'Trainee',
      username: userData.username || 'trainee',
    });

    // Update with final result
    await adminDb.doc(`users/${uid}`).update({
      onboardingStatus: result.status,
      whatsappOnboardedAt: result.sentAt ? new Date(result.sentAt) : null,
      onboardingError: result.error || null,
      updatedAt: new Date(),
    });

    return result;
  }

  /**
   * Batch WhatsApp onboarding trigger for multiple learner UIDs.
   */
  async bulkTriggerWhatsAppOnboarding(uids: string[]): Promise<{
    total: number;
    sentCount: number;
    failedCount: number;
    results: WhatsAppOnboardingResult[];
  }> {
    const results: WhatsAppOnboardingResult[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const uid of uids) {
      try {
        const res = await this.triggerWhatsAppOnboarding(uid);
        results.push(res);
        if (res.status === 'SENT' || res.status === 'DELIVERED') {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (err: any) {
        failedCount++;
        results.push({
          uid,
          phoneNumber: '',
          status: 'FAILED',
          error: err?.message || 'Failed to dispatch onboarding message',
        });
      }
    }

    return {
      total: uids.length,
      sentCount,
      failedCount,
      results,
    };
  }

  /**
   * Updates an existing learner's details (name, designation, location, phone, status).
   */
  async updateLearner(uid: string, input: UpdateLearnerInput): Promise<LearnerSummaryItem> {
    const userRef = adminDb.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error(`Learner '${uid}' not found.`);
    }

    const currentData = userSnap.data()!;
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.displayName !== undefined) {
      const name = input.displayName.trim();
      if (!name) throw new Error('Learner name cannot be empty.');
      updates.displayName = name;
    }

    if (input.designation !== undefined) {
      const desig = input.designation.trim();
      if (!desig) throw new Error('Designation cannot be empty.');
      updates.designation = desig;
    }

    if (input.healthSubCentre !== undefined) {
      updates.healthSubCentre = input.healthSubCentre.trim();
    }

    // Phone number update with uniqueness check & index re-anchoring
    if (input.phoneNumber !== undefined) {
      const rawPhone = input.phoneNumber.trim();
      if (rawPhone) {
        const phoneCheck = this.whatsappService.normalizePhoneNumber(rawPhone);
        if (!phoneCheck.valid) {
          throw new Error(phoneCheck.error || 'Invalid phone number format.');
        }
        const normalizedPhone = phoneCheck.normalized;

        if (normalizedPhone !== currentData.phoneNumber) {
          if (typeof this.userRepo.findByPhoneNumber === 'function') {
            const existingPhoneRecord = await this.userRepo.findByPhoneNumber(normalizedPhone);
            if (existingPhoneRecord && existingPhoneRecord.uid && existingPhoneRecord.uid !== uid) {
              throw new Error(`Phone number ${normalizedPhone} is already in use by another learner.`);
            }
          }

          if (currentData.phoneNumber && typeof this.userRepo.releasePhoneNumber === 'function') {
            await this.userRepo.releasePhoneNumber(currentData.phoneNumber, 'admin_update', uid);
          }

          if (typeof this.userRepo.activatePhoneNumber === 'function') {
            const tempResId = `admin_${Date.now()}`;
            if (typeof this.userRepo.reservePhoneNumber === 'function') {
              await this.userRepo.reservePhoneNumber(normalizedPhone, tempResId);
            }
            await this.userRepo.activatePhoneNumber(normalizedPhone, uid, tempResId);
          }

          updates.phoneNumber = normalizedPhone;
        }
      }
    }

    // Account status update
    if (input.accountStatus !== undefined) {
      const newStatus = input.accountStatus;
      updates.accountStatus = newStatus;
      if (newStatus === 'DEACTIVATED') {
        await this.authProvider.revokeUserSessions(uid);
        if (typeof this.authProvider.updateUserDisabled === 'function') {
          await this.authProvider.updateUserDisabled(uid, true);
        }
      } else if (newStatus === 'ACTIVE') {
        if (typeof this.authProvider.updateUserDisabled === 'function') {
          await this.authProvider.updateUserDisabled(uid, false);
        }
      }
    }

    await userRef.update(updates);

    return (await this.getLearnerDetails(uid))!;
  }

  /**
   * Deactivates or activates a learner account.
   */
  async setLearnerStatus(uid: string, status: 'ACTIVE' | 'DEACTIVATED'): Promise<LearnerSummaryItem> {
    return this.updateLearner(uid, { accountStatus: status });
  }

  /**
   * Resets credentials for a learner, assigning a new temporary password and returning access instructions.
   */
  async resetLearnerCredentials(uid: string): Promise<ResetCredentialsResult> {
    const learner = await this.getLearnerDetails(uid);
    if (!learner) {
      throw new Error(`Learner '${uid}' not found.`);
    }

    // Generate secure temporary password
    const digits = (learner.phoneNumber || '1234').replace(/\D/g, '').slice(-4) || '2026';
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const temporaryPassword = `AuSkill@${digits}${randomSuffix}`;

    // Update password in Firebase Auth
    if (typeof this.authProvider.updateUserPassword === 'function') {
      await this.authProvider.updateUserPassword(uid, temporaryPassword);
    } else {
      const { adminAuth } = await import('../../infrastructure/config/firebaseAdmin.js');
      await adminAuth.updateUser(uid, { password: temporaryPassword });
    }

    // Revoke previous sessions
    await this.authProvider.revokeUserSessions(uid);

    const loginIdentifier = learner.phoneNumber || `@${learner.username}`;
    const loginUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    const instructions =
      `*AuSkill RBSK Learning Platform — Access Instructions*\n\n` +
      `Namaste ${learner.displayName},\n` +
      `Your training account has been provisioned by the RBSK Program Administrator.\n\n` +
      `📱 *Login ID*: ${loginIdentifier}\n` +
      `🔑 *Temporary Password*: ${temporaryPassword}\n` +
      `🌐 *App Link*: ${loginUrl}\n\n` +
      `Please open the link on your mobile, sign in, and complete your 10-question daily clinical mission.`;

    return {
      uid,
      username: learner.username,
      phoneNumber: learner.phoneNumber,
      temporaryPassword,
      loginUrl,
      instructions,
    };
  }
}

export const defaultAdminLearnerUseCase = new AdminLearnerUseCase();
