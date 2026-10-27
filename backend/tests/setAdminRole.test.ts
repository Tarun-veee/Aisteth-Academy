import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveUserIdentifier,
  setAdminRole,
  VALID_ADMIN_ROLES,
} from '../scripts/set_admin_role.js';
import { requireAdminRole } from '../src/api/middlewares/admin.middleware.js';

describe('Administrative Role Elevation & set_admin_role.js Suite', () => {
  let mockDb: any;
  let mockAuth: any;
  let mockUsersCollection: Map<string, any>;
  let mockUsernamesCollection: Map<string, any>;
  let mockAuthUsers: Map<string, any>;

  const SAMPLE_UID = 'UjofqlcL6pWLL4jq7WtEZliab8L2';

  beforeEach(() => {
    mockUsersCollection = new Map();
    mockUsernamesCollection = new Map();
    mockAuthUsers = new Map();

    // Seed test trainee (mirroring admin_tester account)
    mockUsersCollection.set(SAMPLE_UID, {
      uid: SAMPLE_UID,
      username: 'admintester',
      displayName: 'admin_tester',
      syntheticEmail: 'admintester@trainee.aisteth.internal',
      optionalEmail: 'admintester@aisteth.com',
      role: 'TRAINEE',
      designation: 'ASHA_WORKER',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      learningState: {
        totalXp: 50,
        currentStreak: 2,
        currentLevel: 1,
      },
    });

    mockUsernamesCollection.set('admintester', {
      username: 'admintester',
      uid: SAMPLE_UID,
      status: 'ACTIVE',
    });

    mockAuthUsers.set(SAMPLE_UID, {
      uid: SAMPLE_UID,
      email: 'admintester@trainee.aisteth.internal',
      displayName: 'admin_tester',
      customClaims: {},
    });

    // Mock Firestore API
    mockDb = {
      collection: vi.fn((colName: string) => {
        if (colName === 'users') {
          return {
            doc: vi.fn((docId: string) => ({
              get: vi.fn(async () => ({
                exists: mockUsersCollection.has(docId),
                id: docId,
                data: () => mockUsersCollection.get(docId),
              })),
              update: vi.fn(async (updates: any) => {
                const current = mockUsersCollection.get(docId) || {};
                mockUsersCollection.set(docId, { ...current, ...updates });
              }),
            })),
            where: vi.fn((field: string, op: string, val: any) => ({
              get: vi.fn(async () => {
                const matchedDocs: any[] = [];
                for (const [id, data] of mockUsersCollection.entries()) {
                  if (data[field] === val) {
                    matchedDocs.push({
                      id,
                      data: () => data,
                    });
                  }
                }
                return { docs: matchedDocs };
              }),
            })),
          };
        }

        if (colName === 'usernames') {
          return {
            doc: vi.fn((docId: string) => ({
              get: vi.fn(async () => ({
                exists: mockUsernamesCollection.has(docId),
                id: docId,
                data: () => mockUsernamesCollection.get(docId),
              })),
              set: vi.fn(async (data: any) => {
                mockUsernamesCollection.set(docId, data);
              }),
            })),
          };
        }

        return {
          doc: vi.fn(() => ({
            get: vi.fn(async () => ({ exists: false, data: () => null })),
          })),
        };
      }),
    };

    // Mock Firebase Auth API
    mockAuth = {
      getUser: vi.fn(async (uid: string) => {
        const u = mockAuthUsers.get(uid);
        if (!u) {
          const err: any = new Error(`User not found: ${uid}`);
          err.code = 'auth/user-not-found';
          throw err;
        }
        return u;
      }),
      getUserByEmail: vi.fn(async (email: string) => {
        for (const u of mockAuthUsers.values()) {
          if (u.email === email) return u;
        }
        const err: any = new Error(`User not found for email: ${email}`);
        err.code = 'auth/user-not-found';
        throw err;
      }),
      setCustomUserClaims: vi.fn(async (uid: string, claims: any) => {
        const u = mockAuthUsers.get(uid);
        if (u) {
          u.customClaims = { ...(u.customClaims || {}), ...claims };
        }
      }),
    };
  });

  // =========================================================================
  // 1. IDENTIFIER RESOLUTION TESTS
  // =========================================================================
  describe('User Identifier Resolution (resolveUserIdentifier)', () => {
    it('resolves user directly by exact Firestore document ID (UID)', async () => {
      const result = await resolveUserIdentifier(SAMPLE_UID, mockDb, mockAuth);
      expect(result.uid).toBe(SAMPLE_UID);
      expect(result.matchedStrategy).toContain('Direct Firestore Document ID');
    });

    it('resolves user by exact username stored in usernames collection', async () => {
      const result = await resolveUserIdentifier('admintester', mockDb, mockAuth);
      expect(result.uid).toBe(SAMPLE_UID);
      expect(result.matchedStrategy).toContain('usernames collection document "@admintester"');
    });

    it('resolves user by display name when username had stripped underscore (admin_tester -> admintester)', async () => {
      const result = await resolveUserIdentifier('admin_tester', mockDb, mockAuth);
      expect(result.uid).toBe(SAMPLE_UID);
      expect(result.userDoc.data().displayName).toBe('admin_tester');
    });

    it('resolves user by email address (synthetic or optional)', async () => {
      const result = await resolveUserIdentifier('admintester@aisteth.com', mockDb, mockAuth);
      expect(result.uid).toBe(SAMPLE_UID);
    });

    it('throws clear, informative error when identifier cannot be found', async () => {
      await expect(
        resolveUserIdentifier('non_existent_account', mockDb, mockAuth)
      ).rejects.toThrow('User not found for identifier "non_existent_account"');
    });

    it('throws error when target identifier is empty or invalid', async () => {
      await expect(
        resolveUserIdentifier('', mockDb, mockAuth)
      ).rejects.toThrow('Target identifier must be a non-empty string');
    });
  });

  // =========================================================================
  // 2. ROLE VALIDATION & ASSIGNMENT
  // =========================================================================
  describe('Administrative Role Elevation (setAdminRole)', () => {
    it('rejects invalid or unauthorized roles', async () => {
      await expect(
        setAdminRole('admin_tester', 'TRAINEE', mockDb, mockAuth)
      ).rejects.toThrow('Invalid role "TRAINEE". Allowed administrative roles are: PLATFORM_ADMIN, SUPERVISOR');

      await expect(
        setAdminRole('admin_tester', 'SUPERADMIN', mockDb, mockAuth)
      ).rejects.toThrow('Invalid role "SUPERADMIN"');
    });

    it('successfully elevates admin_tester to PLATFORM_ADMIN across Firestore and Auth', async () => {
      const result = await setAdminRole('admin_tester', 'PLATFORM_ADMIN', mockDb, mockAuth);

      expect(result.success).toBe(true);
      expect(result.uid).toBe(SAMPLE_UID);
      expect(result.previousRole).toBe('TRAINEE');
      expect(result.role).toBe('PLATFORM_ADMIN');
      expect(result.customClaimsApplied).toBe(true);

      // Verify Firestore persistence
      const updatedUser = mockUsersCollection.get(SAMPLE_UID);
      expect(updatedUser.role).toBe('PLATFORM_ADMIN');
      // Ensure other fields are NOT overwritten
      expect(updatedUser.displayName).toBe('admin_tester');
      expect(updatedUser.username).toBe('admintester');
      expect(updatedUser.designation).toBe('ASHA_WORKER');
      expect(updatedUser.learningState.totalXp).toBe(50);

      // Verify Firebase Auth custom claims
      const authUser = mockAuthUsers.get(SAMPLE_UID);
      expect(authUser.customClaims.role).toBe('PLATFORM_ADMIN');

      // Verify alias was added to usernames collection
      expect(mockUsernamesCollection.has('admin_tester')).toBe(true);
      expect(mockUsernamesCollection.get('admin_tester').uid).toBe(SAMPLE_UID);
    });

    it('successfully elevates user to SUPERVISOR role', async () => {
      const result = await setAdminRole('admin_tester', 'SUPERVISOR', mockDb, mockAuth);
      expect(result.success).toBe(true);
      expect(result.role).toBe('SUPERVISOR');

      const updatedUser = mockUsersCollection.get(SAMPLE_UID);
      expect(updatedUser.role).toBe('SUPERVISOR');
    });

    it('persists role elevation idempotently when called multiple times', async () => {
      const res1 = await setAdminRole('admin_tester', 'PLATFORM_ADMIN', mockDb, mockAuth);
      expect(res1.role).toBe('PLATFORM_ADMIN');

      const res2 = await setAdminRole('admin_tester', 'PLATFORM_ADMIN', mockDb, mockAuth);
      expect(res2.role).toBe('PLATFORM_ADMIN');
      expect(res2.previousRole).toBe('PLATFORM_ADMIN');
    });
  });

  // =========================================================================
  // 3. AUTHORIZATION INTEGRATION (requireAdminRole)
  // =========================================================================
  describe('Authorization Integration with requireAdminRole Middleware', () => {
    it('grants access to elevated user via custom claims', async () => {
      const req: any = {
        user: { uid: SAMPLE_UID, role: 'PLATFORM_ADMIN' },
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

    it('rejects access if user remains in TRAINEE role', async () => {
      const req: any = {
        user: { uid: 'trainee_999', role: 'TRAINEE' },
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
          code: 'FORBIDDEN_NOT_ADMIN',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
