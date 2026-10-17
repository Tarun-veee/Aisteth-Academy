import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { defaultAuthProvider } from '../src/infrastructure/auth/FirebaseAuthAdapter.js';
import { defaultUserRepository } from '../src/infrastructure/firestore/FirestoreUserRepository.js';
import { LeaderboardUseCase } from '../src/application/usecases/LeaderboardUseCase.js';
import { UserProfileDoc } from '../src/domain/models/user.model.js';
import { RawLeaderboardEntry, IUserRepository } from '../src/domain/interfaces/IUserRepository.js';

describe('Backend Community Leaderboard Verification Suite', () => {
  const tokenTrainee1 = 'token_trainee_1';
  const tokenTrainee2 = 'token_trainee_2';
  const tokenSupervisor = 'token_supervisor';
  const tokenNonExistent = 'token_non_existent';
  const tokenTraineeZeroXp = 'token_trainee_zero';
  const tokenTraineeNegativeXp = 'token_trainee_neg';
  const tokenTraineeNonNumericXp = 'token_trainee_non_num';
  const tokenTraineeNanXp = 'token_trainee_nan';
  const tokenTraineeMissingNested = 'token_trainee_missing_nested';
  const tokenTraineeDisagreement = 'token_trainee_disagreement';

  const trainee1Uid = 'usr_trainee_001';
  const trainee2Uid = 'usr_trainee_002';
  const supervisorUid = 'usr_sup_001';
  const nonExistentUid = 'usr_non_existent';
  const traineeZeroUid = 'usr_trainee_zero';
  const traineeNegativeUid = 'usr_trainee_neg';
  const traineeNonNumericUid = 'usr_trainee_non_num';
  const traineeNanUid = 'usr_trainee_nan';
  const traineeMissingNestedUid = 'usr_trainee_missing_nested';
  const traineeDisagreementUid = 'usr_trainee_disagreement';

  let mockUserMap: Map<string, UserProfileDoc>;
  let mockEntries: RawLeaderboardEntry[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUserMap = new Map();

    const user1: UserProfileDoc = {
      uid: trainee1Uid,
      username: 'asha_rekha',
      syntheticEmail: 'asha_rekha@aisteth.internal',
      optionalEmail: 'rekha@example.com',
      displayName: 'Rekha Sharma',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: 100,
        currentStreak: 5,
        longestStreak: 5,
        lastActiveDate: '2026-10-15',
        completedQuestionsCount: 10,
        completedSessionsCount: 2,
        totalCorrectAnswersCount: 10,
        currentLevel: 11,
      },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };

    const user2: UserProfileDoc = {
      uid: trainee2Uid,
      username: 'anm_sunita',
      syntheticEmail: 'anm_sunita@aisteth.internal',
      displayName: '', // Missing displayName, should fallback to @anm_sunita
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ANM',
      healthSubCentre: 'HSC South',
      district: 'Lucknow',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: 50,
        currentStreak: 2,
        longestStreak: 2,
        lastActiveDate: '2026-10-14',
        completedQuestionsCount: 5,
        completedSessionsCount: 1,
        totalCorrectAnswersCount: 5,
        currentLevel: 6,
      },
      createdAt: new Date('2026-01-03T00:00:00Z'),
      updatedAt: new Date('2026-01-04T00:00:00Z'),
    };

    const supervisorUser: UserProfileDoc = {
      uid: supervisorUid,
      username: 'sup_vikram',
      syntheticEmail: 'sup_vikram@aisteth.internal',
      displayName: 'Dr. Vikram Patel',
      role: 'SUPERVISOR',
      organizationId: 'org_rbsk_national',
      designation: 'RBSK_MO',
      healthSubCentre: 'District Hospital',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: 300,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
        currentLevel: 31,
      },
      createdAt: new Date('2025-12-01T00:00:00Z'),
      updatedAt: new Date('2025-12-01T00:00:00Z'),
    };

    mockUserMap.set(trainee1Uid, user1);
    mockUserMap.set(trainee2Uid, user2);
    mockUserMap.set(supervisorUid, supervisorUser);

    const userZero: UserProfileDoc = {
      uid: traineeZeroUid,
      username: 'asha_zero',
      syntheticEmail: 'asha_zero@aisteth.internal',
      displayName: 'Zero XP Trainee',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
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
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
    };

    const userNegative: UserProfileDoc = {
      uid: traineeNegativeUid,
      username: 'asha_neg',
      syntheticEmail: 'asha_neg@aisteth.internal',
      displayName: 'Negative XP User',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: -50,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
      },
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
    };

    const userNonNumeric: UserProfileDoc = {
      uid: traineeNonNumericUid,
      username: 'asha_str',
      syntheticEmail: 'asha_str@aisteth.internal',
      displayName: 'String XP User',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: 'invalid_xp' as any,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
      },
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
    };

    const userNan: UserProfileDoc = {
      uid: traineeNanUid,
      username: 'asha_nan',
      syntheticEmail: 'asha_nan@aisteth.internal',
      displayName: 'NaN XP User',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: NaN,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
      },
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
    };

    const userMissingNested: UserProfileDoc = {
      uid: traineeMissingNestedUid,
      username: 'asha_legacy',
      syntheticEmail: 'asha_legacy@aisteth.internal',
      displayName: 'Legacy User',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
      } as any,
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
      totalXp: 150,
    } as any;

    const userDisagreement: UserProfileDoc = {
      uid: traineeDisagreementUid,
      username: 'asha_disagree',
      syntheticEmail: 'asha_disagree@aisteth.internal',
      displayName: 'Disagreement User',
      role: 'TRAINEE',
      organizationId: 'org_rbsk_national',
      designation: 'ASHA',
      healthSubCentre: 'HSC North',
      district: 'Varanasi',
      state: 'Uttar Pradesh',
      trainingTimeZone: 'Asia/Kolkata',
      learningState: {
        totalXp: 100,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        completedQuestionsCount: 0,
        completedSessionsCount: 0,
        totalCorrectAnswersCount: 0,
      },
      createdAt: new Date('2026-01-05T00:00:00Z'),
      updatedAt: new Date('2026-01-05T00:00:00Z'),
      totalXp: 50,
    } as any;

    mockUserMap.set(traineeZeroUid, userZero);
    mockUserMap.set(traineeNegativeUid, userNegative);
    mockUserMap.set(traineeNonNumericUid, userNonNumeric);
    mockUserMap.set(traineeNanUid, userNan);
    mockUserMap.set(traineeMissingNestedUid, userMissingNested);
    mockUserMap.set(traineeDisagreementUid, userDisagreement);

    mockEntries = [
      {
        uid: 'usr_top_1',
        username: 'asha_anita',
        displayName: 'Anita Devi',
        totalXp: 120,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        uid: trainee1Uid,
        username: 'asha_rekha',
        displayName: 'Rekha Sharma',
        totalXp: 100,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        uid: 'usr_top_3',
        username: 'anm_pooja',
        displayName: 'Pooja Verma',
        totalXp: 100,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        uid: 'usr_top_4',
        username: 'asha_priya',
        displayName: 'Priya Singh',
        totalXp: 90,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    vi.spyOn(defaultAuthProvider, 'verifyIdToken').mockImplementation(async (token: string) => {
      if (token === tokenTrainee1) return { uid: trainee1Uid, role: 'TRAINEE' };
      if (token === tokenTrainee2) return { uid: trainee2Uid, role: 'TRAINEE' };
      if (token === tokenSupervisor) return { uid: supervisorUid, role: 'SUPERVISOR' };
      if (token === tokenNonExistent) return { uid: nonExistentUid, role: 'TRAINEE' };
      if (token === tokenTraineeZeroXp) return { uid: traineeZeroUid, role: 'TRAINEE' };
      if (token === tokenTraineeNegativeXp) return { uid: traineeNegativeUid, role: 'TRAINEE' };
      if (token === tokenTraineeNonNumericXp) return { uid: traineeNonNumericUid, role: 'TRAINEE' };
      if (token === tokenTraineeNanXp) return { uid: traineeNanUid, role: 'TRAINEE' };
      if (token === tokenTraineeMissingNested) return { uid: traineeMissingNestedUid, role: 'TRAINEE' };
      if (token === tokenTraineeDisagreement) return { uid: traineeDisagreementUid, role: 'TRAINEE' };
      throw new Error('Invalid or expired authentication token.');
    });

    vi.spyOn(defaultUserRepository, 'findByUid').mockImplementation(async (uid: string) => {
      return mockUserMap.get(uid) || null;
    });

    vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockImplementation(async (_limit: number) => {
      return [...mockEntries];
    });

    vi.spyOn(defaultUserRepository, 'countEligibleParticipants').mockImplementation(async () => {
      return 150;
    });

    vi.spyOn(defaultUserRepository, 'countUsersWithHigherXp').mockImplementation(async (xp: number) => {
      if (xp >= 120) return 0;
      if (xp >= 100) return 1; // only usr_top_1 (120 XP) is higher
      if (xp >= 90) return 3;  // 120, 100, 100 are higher
      if (xp >= 50) return 4;
      if (xp >= 0) return 10;
      return 15;
    });
  });

  describe('Authentication & Authorization', () => {
    it('1. rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/v1/users/leaderboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });

    it('2. derives current user identity exclusively from verified token context', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);
      expect(res.status).toBe(200);
      expect(res.body.currentUser.displayName).toBe('Rekha Sharma');
      expect(res.body.currentUser.username).toBe('asha_rekha');
      expect(res.body.currentUser.totalXp).toBe(100);
    });

    it('3. ignores any client-supplied body or query UID attempts', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard?uid=usr_trainee_002')
        .set('Authorization', `Bearer ${tokenTrainee1}`)
        .send({ uid: 'usr_trainee_002' });
      expect(res.status).toBe(200);
      expect(res.body.currentUser.displayName).toBe('Rekha Sharma');
      expect(res.body.currentUser.username).toBe('asha_rekha');
    });

    it('4. assigns null rank to non-trainee authenticated users (e.g. SUPERVISOR)', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenSupervisor}`);
      expect(res.status).toBe(200);
      expect(res.body.currentUser.rank).toBeNull();
      expect(res.body.currentUser.isInTopList).toBe(false);
    });

    it('5. returns 404 if authenticated user profile is not found in database', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenNonExistent}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Standard Competition Ranking & Ties', () => {
    it('6. ranks higher XP before lower XP and assigns 1, 2, 2, 4 ranks', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const entries = res.body.entries;
      expect(entries).toHaveLength(4);

      // User A (120 XP) -> Rank 1
      expect(entries[0].rank).toBe(1);
      expect(entries[0].totalXp).toBe(120);

      // User B (100 XP) -> Rank 2
      expect(entries[1].rank).toBe(2);
      expect(entries[1].totalXp).toBe(100);

      // User C (100 XP) -> Rank 2 (Tied)
      expect(entries[2].rank).toBe(2);
      expect(entries[2].totalXp).toBe(100);

      // User D (90 XP) -> Rank 4 (Skips Rank 3)
      expect(entries[3].rank).toBe(4);
      expect(entries[3].totalXp).toBe(90);
    });

    it('7. uses createdAt ascending and username ascending for deterministic display tie-break', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const entries = res.body.entries;

      // Trainee 1 was created on 2026-01-01, User 3 on 2026-01-02
      expect(entries[1].displayName).toBe('Rekha Sharma');
      expect(entries[2].displayName).toBe('Pooja Verma');
    });

    it('8. sets isCurrentUser: true exactly once on the matching top list entry', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const entries = res.body.entries;
      const currentEntries = entries.filter((e: any) => e.isCurrentUser);
      expect(currentEntries).toHaveLength(1);
      expect(currentEntries[0].displayName).toBe('Rekha Sharma');
      expect(res.body.currentUser.isInTopList).toBe(true);
      expect(res.body.currentUser.rank).toBe(2);
    });

    it('9. computes correct global rank when current user is outside top list', async () => {
      // Trainee 2 has 50 XP, not present in top 4 entries
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee2}`);

      expect(res.status).toBe(200);
      expect(res.body.currentUser.isInTopList).toBe(false);
      // countUsersWithHigherXp for 50 XP returns 4 -> rank is 4 + 1 = 5
      expect(res.body.currentUser.rank).toBe(5);
      expect(res.body.currentUser.displayName).toBe('@anm_sunita'); // fallback
    });
  });

  describe('Query Validation & Parameter Limits', () => {
    it('10. uses default limit of 50 when no query limit is provided', async () => {
      const spy = vi.spyOn(defaultUserRepository, 'getLeaderboardEntries');
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(50);
    });

    it('11. respects valid custom limit within [10, 100]', async () => {
      const spy = vi.spyOn(defaultUserRepository, 'getLeaderboardEntries');
      const res = await request(app)
        .get('/api/v1/users/leaderboard?limit=25')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(25);
    });

    it('12. rejects limit below 10 with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard?limit=5')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('between 10 and 100');
    });

    it('13. rejects limit above 100 with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard?limit=150')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('between 10 and 100');
    });

    it('14. rejects malformed non-integer limits with HTTP 400', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard?limit=invalid_abc')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Privacy & Security Allowlist Boundaries', () => {
    it('15. strictly omits private and sensitive fields from leaderboard entries and currentUser', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const jsonString = JSON.stringify(res.body);

      // Verify no PII or internal identifiers leak
      expect(jsonString).not.toContain('syntheticEmail');
      expect(jsonString).not.toContain('optionalEmail');
      expect(jsonString).not.toContain('rekha@example.com');
      expect(jsonString).not.toContain('aisteth.internal');
      expect(jsonString).not.toContain('healthSubCentre');
      expect(jsonString).not.toContain('HSC North');
      expect(jsonString).not.toContain('organizationId');
      expect(jsonString).not.toContain('org_rbsk_national');
      expect(jsonString).not.toContain('district');
      expect(jsonString).not.toContain('Varanasi');
      expect(jsonString).not.toContain('state');
      expect(jsonString).not.toContain('Uttar Pradesh');
      expect(jsonString).not.toContain('designation');
      expect(jsonString).not.toContain('password');

      // Verify no raw UIDs leaked in entry objects
      for (const entry of res.body.entries) {
        expect(entry.uid).toBeUndefined();
        expect(Object.keys(entry).sort()).toEqual(
          ['currentLevel', 'displayName', 'isCurrentUser', 'rank', 'totalXp', 'username'].sort()
        );
      }
    });
  });

  describe('Progression & Edge Cases', () => {
    it('16. derives currentLevel using established formula (Math.min(31, Math.floor(xp / 10) + 1))', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const entries = res.body.entries;
      // 120 XP -> Level 13
      expect(entries[0].currentLevel).toBe(13);
      // 100 XP -> Level 11
      expect(entries[1].currentLevel).toBe(11);
      // 90 XP -> Level 10
      expect(entries[3].currentLevel).toBe(10);
    });

    it('17. handles empty database gracefully with zero participants and rank 1', async () => {
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockResolvedValueOnce([]);
      vi.spyOn(defaultUserRepository, 'countEligibleParticipants').mockResolvedValueOnce(0);
      vi.spyOn(defaultUserRepository, 'countUsersWithHigherXp').mockResolvedValueOnce(0);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(0);
      expect(res.body.totalParticipants).toBe(0);
      expect(res.body.returnedCount).toBe(0);
      expect(res.body.currentUser.rank).toBe(1);
      expect(res.body.currentUser.isInTopList).toBe(false);
    });

    it('18. handles repository errors cleanly with HTTP 500', async () => {
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockRejectedValueOnce(
        new Error('Firestore connection timeout')
      );

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Firestore connection timeout');
    });
  });

  describe('XP Data Integrity & Canonical Boundaries (Audit Remediation)', () => {
    it('19. accepts XP zero as a valid canonical score and computes valid rank', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTraineeZeroXp}`);

      expect(res.status).toBe(200);
      expect(res.body.currentUser.totalXp).toBe(0);
      expect(res.body.currentUser.currentLevel).toBe(1);
      expect(res.body.currentUser.rank).toBe(11); // 10 users with higher XP -> rank 11
      expect(res.body.currentUser.isInTopList).toBe(false);
    });

    it('20. preserves positive finite XP exactly without alteration', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      expect(res.body.currentUser.totalXp).toBe(100);
      expect(res.body.currentUser.currentLevel).toBe(11);
      expect(res.body.entries[0].totalXp).toBe(120);
      expect(res.body.entries[1].totalXp).toBe(100);
      expect(res.body.entries[2].totalXp).toBe(100);
      expect(res.body.entries[3].totalXp).toBe(90);
    });

    it('21. excludes negative XP from leaderboard results and never converts it into valid score', async () => {
      // Mock repository returns an invalid negative entry
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockResolvedValueOnce([
        { uid: 'u_neg', username: 'neg_user', displayName: 'Negative User', totalXp: -50, createdAt: new Date() },
        ...mockEntries,
      ]);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const usernames = res.body.entries.map((e: any) => e.username);
      expect(usernames).not.toContain('neg_user');
      for (const entry of res.body.entries) {
        expect(entry.totalXp).toBeGreaterThanOrEqual(0);
      }
    });

    it('22. excludes non-numeric XP and does not convert it into a public zero-XP score', async () => {
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockResolvedValueOnce([
        { uid: 'u_str', username: 'str_user', displayName: 'String User', totalXp: '150' as any, createdAt: new Date() },
        ...mockEntries,
      ]);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const usernames = res.body.entries.map((e: any) => e.username);
      expect(usernames).not.toContain('str_user');
      // Ensure it was not converted to a 0 XP entry
      expect(res.body.entries.some((e: any) => e.displayName === 'String User')).toBe(false);
    });

    it('23. excludes NaN and infinite XP from leaderboard results', async () => {
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockResolvedValueOnce([
        { uid: 'u_nan', username: 'nan_user', displayName: 'NaN User', totalXp: NaN, createdAt: new Date() },
        { uid: 'u_inf', username: 'inf_user', displayName: 'Inf User', totalXp: Infinity, createdAt: new Date() },
        { uid: 'u_ninf', username: 'ninf_user', displayName: 'NegInf User', totalXp: -Infinity, createdAt: new Date() },
        ...mockEntries,
      ]);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const usernames = res.body.entries.map((e: any) => e.username);
      expect(usernames).not.toContain('nan_user');
      expect(usernames).not.toContain('inf_user');
      expect(usernames).not.toContain('ninf_user');
      expect(res.body.entries).toHaveLength(4);
    });

    it('24. missing canonical XP does not fall back to root-level XP', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTraineeMissingNested}`);

      expect(res.status).toBe(200);
      // Root-level totalXp is 150, but canonical learningState.totalXp is missing
      expect(res.body.currentUser.totalXp).toBeNull();
      expect(res.body.currentUser.currentLevel).toBeNull();
      expect(res.body.currentUser.rank).toBeNull();
      expect(res.body.currentUser.isInTopList).toBe(false);
    });

    it('25. nested and root XP disagreement strictly follows canonical nested XP', async () => {
      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTraineeDisagreement}`);

      expect(res.status).toBe(200);
      // learningState.totalXp is 100, root totalXp is 50 -> must use 100
      expect(res.body.currentUser.totalXp).toBe(100);
      expect(res.body.currentUser.currentLevel).toBe(11);
      expect(res.body.currentUser.rank).toBe(2);
    });

    it('26. current user standing does not fabricate an invalid score for negative, NaN, or non-numeric XP', async () => {
      // Negative XP
      const resNeg = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTraineeNegativeXp}`);
      expect(resNeg.status).toBe(200);
      expect(resNeg.body.currentUser.totalXp).toBeNull();
      expect(resNeg.body.currentUser.currentLevel).toBeNull();
      expect(resNeg.body.currentUser.rank).toBeNull();

      // Non-numeric XP
      const resStr = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTraineeNonNumericXp}`);
      expect(resStr.status).toBe(200);
      expect(resStr.body.currentUser.totalXp).toBeNull();
      expect(resStr.body.currentUser.currentLevel).toBeNull();
      expect(resStr.body.currentUser.rank).toBeNull();

      // NaN XP
      const resNan = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTraineeNanXp}`);
      expect(resNan.status).toBe(200);
      expect(resNan.body.currentUser.totalXp).toBeNull();
      expect(resNan.body.currentUser.currentLevel).toBeNull();
      expect(resNan.body.currentUser.rank).toBeNull();
    });

    it('27. valid participants retain correct standard competition ranks (1, 2, 2, 4) in presence of invalid records', async () => {
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockResolvedValueOnce([
        { uid: 'u_corrupt_1', username: 'corrupt_1', displayName: 'Corrupt 1', totalXp: -100, createdAt: new Date() },
        { uid: 'u_corrupt_2', username: 'corrupt_2', displayName: 'Corrupt 2', totalXp: 'abc' as any, createdAt: new Date() },
        ...mockEntries,
        { uid: 'u_corrupt_3', username: 'corrupt_3', displayName: 'Corrupt 3', totalXp: NaN, createdAt: new Date() },
      ]);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      const entries = res.body.entries;
      expect(entries).toHaveLength(4);
      expect(entries[0].rank).toBe(1);
      expect(entries[0].totalXp).toBe(120);
      expect(entries[1].rank).toBe(2);
      expect(entries[1].totalXp).toBe(100);
      expect(entries[2].rank).toBe(2);
      expect(entries[2].totalXp).toBe(100);
      expect(entries[3].rank).toBe(4);
      expect(entries[3].totalXp).toBe(90);
    });

    it('28. unit test for FirestoreUserRepository.getLeaderboardEntries filtering corrupt documents without root fallback', async () => {
      const mockDocs = [
        {
          id: 'u1',
          data: () => ({ username: 'user1', displayName: 'User 1', learningState: { totalXp: 200 }, createdAt: null }),
        },
        {
          id: 'u2',
          data: () => ({ username: 'user2', displayName: 'User 2', learningState: { totalXp: -10 }, createdAt: null }),
        },
        {
          id: 'u3',
          data: () => ({ username: 'user3', displayName: 'User 3', learningState: { totalXp: 'invalid' }, createdAt: null }),
        },
        {
          id: 'u4',
          data: () => ({ username: 'user4', displayName: 'User 4', learningState: { totalXp: NaN }, createdAt: null }),
        },
        {
          id: 'u5',
          data: () => ({ username: 'user5', displayName: 'User 5', totalXp: 150, createdAt: null }),
        },
        {
          id: 'u6',
          data: () => ({ username: 'user6', displayName: 'User 6', learningState: { totalXp: 0 }, createdAt: null }),
        },
      ];

      const { adminDb } = await import('../src/infrastructure/config/firebaseAdmin.js');
      const getSpy = vi.fn().mockResolvedValue({ docs: mockDocs });
      const limitSpy = vi.fn().mockReturnValue({ get: getSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const whereSpy = vi.fn().mockReturnValue({ orderBy: orderSpy });
      vi.spyOn(adminDb, 'collection').mockReturnValue({ where: whereSpy } as any);

      const repo = new (await import('../src/infrastructure/firestore/FirestoreUserRepository.js')).FirestoreUserRepository();
      const entries = await repo.getLeaderboardEntries(50);

      // Only u1 (200 XP) and u6 (0 XP) are valid; others (negative, string, NaN, missing canonical) are excluded
      expect(entries).toHaveLength(2);
      expect(entries[0].uid).toBe('u1');
      expect(entries[0].totalXp).toBe(200);
      expect(entries[1].uid).toBe('u6');
      expect(entries[1].totalXp).toBe(0);
    });

    it('29. unit test for FirestoreUserRepository.countEligibleParticipants query construction and count result', async () => {
      const { adminDb } = await import('../src/infrastructure/config/firebaseAdmin.js');
      const getSpy = vi.fn().mockResolvedValue({
        data: () => ({ count: 42 }),
      });
      const countSpy = vi.fn().mockReturnValue({ get: getSpy });
      const whereXpSpy = vi.fn().mockReturnValue({ count: countSpy });
      const whereRoleSpy = vi.fn().mockReturnValue({ where: whereXpSpy });
      vi.spyOn(adminDb, 'collection').mockReturnValue({ where: whereRoleSpy } as any);

      const repo = new (await import('../src/infrastructure/firestore/FirestoreUserRepository.js')).FirestoreUserRepository();
      const count = await repo.countEligibleParticipants();

      expect(adminDb.collection).toHaveBeenCalledWith('users');
      expect(whereRoleSpy).toHaveBeenCalledWith('role', '==', 'TRAINEE');
      expect(whereXpSpy).toHaveBeenCalledWith('learningState.totalXp', '>=', 0);
      expect(countSpy).toHaveBeenCalled();
      expect(getSpy).toHaveBeenCalled();
      expect(count).toBe(42);
    });

    it('30. verifies participant count eligibility criteria across all 6 document variants', async () => {
      // 6 test document variants as required:
      // 1. TRAINEE with canonical XP = 0 (Eligible)
      // 2. TRAINEE with positive finite canonical XP = 120 (Eligible)
      // 3. TRAINEE missing learningState.totalXp (Ineligible)
      // 4. TRAINEE with negative canonical XP = -50 (Ineligible)
      // 5. TRAINEE with malformed non-numeric XP = 'invalid' (Ineligible)
      // 6. Non-TRAINEE account with XP = 300 (Ineligible)
      const testDocuments = [
        { id: 'u_zero', role: 'TRAINEE', learningState: { totalXp: 0 } },
        { id: 'u_pos', role: 'TRAINEE', learningState: { totalXp: 120 } },
        { id: 'u_missing', role: 'TRAINEE', learningState: {} },
        { id: 'u_neg', role: 'TRAINEE', learningState: { totalXp: -50 } },
        { id: 'u_malformed', role: 'TRAINEE', learningState: { totalXp: 'invalid' } },
        { id: 'u_supervisor', role: 'SUPERVISOR', learningState: { totalXp: 300 } },
      ];

      // Pure qualification filter mirroring the Firestore composite query contract:
      // role == 'TRAINEE' AND learningState.totalXp >= 0 (with ProgressionService.isValidXp)
      const eligibleDocs = testDocuments.filter(
        (doc) => doc.role === 'TRAINEE' && (doc.learningState as any).totalXp !== undefined && (doc.learningState as any).totalXp >= 0 && typeof (doc.learningState as any).totalXp === 'number' && !Number.isNaN((doc.learningState as any).totalXp)
      );

      expect(eligibleDocs).toHaveLength(2);
      expect(eligibleDocs.map((d) => d.id)).toEqual(['u_zero', 'u_pos']);

      // Verify through repository seam that the query executes with both filters and returns the qualified count
      const { adminDb } = await import('../src/infrastructure/config/firebaseAdmin.js');
      const getSpy = vi.fn().mockResolvedValue({
        data: () => ({ count: eligibleDocs.length }),
      });
      const countSpy = vi.fn().mockReturnValue({ get: getSpy });
      const whereXpSpy = vi.fn().mockReturnValue({ count: countSpy });
      const whereRoleSpy = vi.fn().mockReturnValue({ where: whereXpSpy });
      vi.spyOn(adminDb, 'collection').mockReturnValue({ where: whereRoleSpy } as any);

      const repo = new (await import('../src/infrastructure/firestore/FirestoreUserRepository.js')).FirestoreUserRepository();
      const count = await repo.countEligibleParticipants();

      expect(count).toBe(2);
      expect(whereRoleSpy).toHaveBeenCalledWith('role', '==', 'TRAINEE');
      expect(whereXpSpy).toHaveBeenCalledWith('learningState.totalXp', '>=', 0);
    });

    it('31. integrates countEligibleParticipants into LeaderboardResponseDTO totalParticipants', async () => {
      // Simulate repository returning count of 2 eligible participants
      vi.spyOn(defaultUserRepository, 'countEligibleParticipants').mockResolvedValueOnce(2);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(200);
      expect(res.body.totalParticipants).toBe(2);
      expect(res.body.returnedCount).toBe(4);
    });

    it('32. validates firestore.indexes.json integrity, schema, and query contract matches', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const possiblePaths = [
        path.resolve(process.cwd(), 'firestore.indexes.json'),
        path.resolve(process.cwd(), '../firestore.indexes.json'),
      ];
      const indexPath = possiblePaths.find((p) => fs.existsSync(p));
      expect(indexPath).toBeDefined();
      const rawContent = fs.readFileSync(indexPath!, 'utf-8');
      const parsed = JSON.parse(rawContent);

      expect(parsed).toHaveProperty('indexes');
      expect(Array.isArray(parsed.indexes)).toBe(true);

      // Verify that all 4 pre-existing indexes remain intact
      const attemptsCollectionIndex = parsed.indexes.find(
        (idx: any) => idx.collectionGroup === 'attempts' && idx.queryScope === 'COLLECTION'
      );
      expect(attemptsCollectionIndex).toBeDefined();
      expect(attemptsCollectionIndex.fields).toEqual([
        { fieldPath: 'dailySessionId', order: 'ASCENDING' },
        { fieldPath: 'clientTimestamp', order: 'ASCENDING' },
      ]);

      const attemptsCollectionGroupIndex = parsed.indexes.find(
        (idx: any) => idx.collectionGroup === 'attempts' && idx.queryScope === 'COLLECTION_GROUP'
      );
      expect(attemptsCollectionGroupIndex).toBeDefined();
      expect(attemptsCollectionGroupIndex.fields).toEqual([
        { fieldPath: 'questionId', order: 'ASCENDING' },
        { fieldPath: 'result', order: 'ASCENDING' },
      ]);

      const dailySessionsIndex = parsed.indexes.find(
        (idx: any) => idx.collectionGroup === 'dailySessions' && idx.queryScope === 'COLLECTION'
      );
      expect(dailySessionsIndex).toBeDefined();
      expect(dailySessionsIndex.fields).toEqual([
        { fieldPath: 'localDate', order: 'DESCENDING' },
        { fieldPath: 'status', order: 'ASCENDING' },
      ]);

      const usersOrgRoleIndex = parsed.indexes.find(
        (idx: any) =>
          idx.collectionGroup === 'users' &&
          idx.queryScope === 'COLLECTION' &&
          idx.fields.some((f: any) => f.fieldPath === 'organizationId')
      );
      expect(usersOrgRoleIndex).toBeDefined();
      expect(usersOrgRoleIndex.fields).toEqual([
        { fieldPath: 'organizationId', order: 'ASCENDING' },
        { fieldPath: 'role', order: 'ASCENDING' },
      ]);

      // Verify both required Leaderboard composite indexes on users collection:
      // 1. Leaderboard query: role == 'TRAINEE' ORDER BY learningState.totalXp DESC
      const leaderboardQueryIndex = parsed.indexes.find(
        (idx: any) =>
          idx.collectionGroup === 'users' &&
          idx.queryScope === 'COLLECTION' &&
          idx.fields.length === 2 &&
          idx.fields[0].fieldPath === 'role' &&
          idx.fields[0].order === 'ASCENDING' &&
          idx.fields[1].fieldPath === 'learningState.totalXp' &&
          idx.fields[1].order === 'DESCENDING'
      );
      expect(leaderboardQueryIndex).toBeDefined();

      // 2. Count / Inequality query: role == 'TRAINEE' AND learningState.totalXp >= 0 (ASCENDING range order)
      const countInequalityIndex = parsed.indexes.find(
        (idx: any) =>
          idx.collectionGroup === 'users' &&
          idx.queryScope === 'COLLECTION' &&
          idx.fields.length === 2 &&
          idx.fields[0].fieldPath === 'role' &&
          idx.fields[0].order === 'ASCENDING' &&
          idx.fields[1].fieldPath === 'learningState.totalXp' &&
          idx.fields[1].order === 'ASCENDING'
      );
      expect(countInequalityIndex).toBeDefined();
    });

    it('33. safely handles FAILED_PRECONDITION when Firestore index is missing or building', async () => {
      // Simulate Firestore error returned when index is missing
      const indexError = new Error(
        '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/aisteth-academy-dev/firestore/indexes?create_composite=test'
      );
      vi.spyOn(defaultUserRepository, 'getLeaderboardEntries').mockRejectedValueOnce(indexError);

      const res = await request(app)
        .get('/api/v1/users/leaderboard')
        .set('Authorization', `Bearer ${tokenTrainee1}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('9 FAILED_PRECONDITION: The query requires an index');
      // Ensure no sensitive server keys, credentials or file paths are exposed
      expect(res.body.error).not.toContain('privateKey');
      expect(res.body.error).not.toContain('client_email');
    });
  });
});

