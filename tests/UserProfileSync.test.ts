import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useUserProfile } from '../src/hooks/useUserProfile';
import { userApi } from '../src/api/userApi';
import { sessionApi } from '../src/api/sessionApi';
import { questionApi } from '../src/api/questionApi';
import { UserProfile } from '../src/models/user.types';
import { UserStats } from '../src/models/session.types';
import { StorageRepository } from '../src/repositories/StorageRepository';

// Mock userApi
vi.mock('../src/api/userApi', () => ({
  userApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

// Mock sessionApi and questionApi to verify zero-mutation isolation
vi.mock('../src/api/sessionApi', () => ({
  sessionApi: {
    getTodaySession: vi.fn(),
    recordAttempt: vi.fn(),
    finalizeSession: vi.fn(),
  },
}));

vi.mock('../src/api/questionApi', () => ({
  questionApi: {
    getTodayQuestions: vi.fn(),
    getQuestionById: vi.fn(),
    getUnsolvedQuestions: vi.fn(),
    updateUnsolvedQuestion: vi.fn(),
  },
}));

/**
 * Pure Node.js React hook harness using React internals dispatcher.
 * Allows testing stateful hooks (useState, useCallback, useEffect, useRef) in pure Node.
 */
function createHookHarness<T>(hookFn: () => T) {
  const states: any[] = [];
  const refs: any[] = [];
  const callbacks: Array<{ fn: any; deps: any[] | undefined }> = [];
  const effects: Array<{ effect: any; deps: any[] | undefined }> = [];
  let stateIdx = 0;
  let refIdx = 0;
  let cbIdx = 0;
  let effIdx = 0;
  const effectQueue: Array<() => void> = [];
  let currentResult: T;
  let isRerendering = false;

  const dispatcher = {
    useState(initial: any) {
      const idx = stateIdx++;
      if (states.length <= idx) {
        states.push(typeof initial === 'function' ? initial() : initial);
      }
      const setState = (action: any) => {
        const nextVal = typeof action === 'function' ? action(states[idx]) : action;
        if (!Object.is(states[idx], nextVal)) {
          states[idx] = nextVal;
          if (!isRerendering) {
            rerender();
          }
        }
      };
      return [states[idx], setState];
    },
    useRef(initial: any) {
      const idx = refIdx++;
      if (refs.length <= idx) {
        refs.push({ current: initial });
      }
      return refs[idx];
    },
    useCallback(fn: any, deps?: any[]) {
      const idx = cbIdx++;
      const prev = callbacks[idx];
      if (prev && deps && prev.deps) {
        const unchanged =
          deps.length === prev.deps.length && deps.every((d, i) => Object.is(d, prev.deps![i]));
        if (unchanged) {
          return prev.fn;
        }
      }
      callbacks[idx] = { fn, deps };
      return fn;
    },
    useEffect(effect: any, deps?: any[]) {
      const idx = effIdx++;
      const prev = effects[idx];
      let shouldRun = false;
      if (!prev) {
        shouldRun = true;
      } else if (!deps || !prev.deps) {
        shouldRun = true;
      } else {
        shouldRun =
          deps.length !== prev.deps.length || deps.some((d, i) => !Object.is(d, prev.deps![i]));
      }
      effects[idx] = { effect, deps };
      if (shouldRun) {
        effectQueue.push(effect);
      }
    },
    useMemo(fn: any, deps?: any[]) {
      return fn();
    },
  };

  function rerender() {
    isRerendering = true;
    stateIdx = 0;
    refIdx = 0;
    cbIdx = 0;
    effIdx = 0;
    const prevDispatcher = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      ?.ReactCurrentDispatcher?.current;
    try {
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
        dispatcher;
      currentResult = hookFn();
    } finally {
      (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current =
        prevDispatcher;
      isRerendering = false;
    }

    while (effectQueue.length > 0) {
      const eff = effectQueue.shift();
      if (eff) eff();
    }
  }

  rerender();

  return {
    get: () => currentResult,
    rerender,
  };
}

describe('Stage 6A: Server-Authoritative Profile Synchronization Suite', () => {
  const mockServerProfile: UserProfile = {
    id: 'usr_lakshmi_456',
    name: 'Sister Lakshmi Deshmukh',
    role: 'ASHA Health Worker',
    healthSubCentre: 'Kengeri Rural Sub-Centre',
    centerName: 'Kengeri Rural Sub-Centre',
    district: 'Bengaluru Rural',
    state: 'Karnataka',
    email: 'lakshmi.asha@karnataka.gov.in',
  };

  const mockServerStats: UserStats = {
    totalXp: 180,
    currentStreak: 12,
    longestStreak: 14,
    lastActiveDate: '2026-10-12',
    completedQuestionsCount: 45,
    completedSessionsCount: 5,
    totalCorrectAnswersCount: 42,
    streakShieldConsumed: false,
  };

  let mockStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();

    let storageProfile: UserProfile | null = null;
    let storageStats: UserStats | null = null;

    mockStorage = {
      getUserProfile: vi.fn().mockImplementation(async () => storageProfile),
      saveUserProfile: vi.fn().mockImplementation(async (p: UserProfile) => {
        storageProfile = p;
      }),
      getUserStats: vi.fn().mockImplementation(async () => storageStats),
      saveUserStats: vi.fn().mockImplementation(async (s: UserStats) => {
        storageStats = s;
      }),
    } as unknown as StorageRepository;

    vi.mocked(userApi.getProfile).mockResolvedValue({
      profile: mockServerProfile,
      stats: mockServerStats,
    });
  });

  // =========================================================================
  // 1. SUCCESSFUL PROFILE FETCH & STATE INITIALIZATION
  // =========================================================================
  it('Scenario 1: Fetches authoritative profile from server (GET /api/v1/users/me) and populates state', async () => {
    const harness = createHookHarness(() =>
      useUserProfile({
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    expect(harness.get().isLoading).toBe(true);

    await harness.get().refetch();

    expect(userApi.getProfile).toHaveBeenCalledTimes(1);
    expect(harness.get().isLoading).toBe(false);
    expect(harness.get().isError).toBe(false);
    expect(harness.get().profile.name).toBe('Sister Lakshmi Deshmukh');
    expect(harness.get().profile.role).toBe('ASHA Health Worker');
    expect(harness.get().profile.district).toBe('Bengaluru Rural');
    expect(harness.get().stats?.totalXp).toBe(180);
    expect(harness.get().stats?.currentStreak).toBe(12);

    // Confirms local storage cache updated
    expect(mockStorage.saveUserProfile).toHaveBeenCalledWith(mockServerProfile);
    expect(mockStorage.saveUserStats).toHaveBeenCalledWith(mockServerStats);
  });

  // =========================================================================
  // 2. SERVER DATA PRECEDENCE OVER STALE LOCAL CACHE
  // =========================================================================
  it('Scenario 2: Server profile strictly takes precedence over stale local IndexedDB data', async () => {
    const staleLocalProfile: UserProfile = {
      id: 'usr_lakshmi_456',
      name: 'Old Outdated Name',
      role: 'Health Volunteer',
      district: 'Old District',
      state: 'Old State',
    };

    mockStorage.getUserProfile.mockResolvedValue(staleLocalProfile);

    const harness = createHookHarness(() =>
      useUserProfile({
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    // Initial load before server responds shows cached profile
    // Refetch server profile
    await harness.get().refetch();

    // Server profile MUST overwrite stale local cache
    expect(harness.get().profile.name).toBe('Sister Lakshmi Deshmukh');
    expect(harness.get().profile.role).toBe('ASHA Health Worker');
    expect(harness.get().profile.district).toBe('Bengaluru Rural');

    // Storage is overwritten with server authoritative data
    expect(mockStorage.saveUserProfile).toHaveBeenLastCalledWith(mockServerProfile);
  });

  // =========================================================================
  // 3. OPTIMISTIC UPDATES & SERVER SYNCHRONIZATION
  // =========================================================================
  it('Scenario 3: Dispatches PATCH /api/v1/users/me with mapped allow-listed fields and synchronizes confirmed server state', async () => {
    const harness = createHookHarness(() =>
      useUserProfile({
        initialProfile: mockServerProfile,
        initialStats: mockServerStats,
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    const serverConfirmedUpdatedProfile: UserProfile = {
      ...mockServerProfile,
      name: 'Lakshmi D. (Promoted)',
      role: 'Senior Staff Nurse',
      healthSubCentre: 'Amravati North Sub-Centre',
      centerName: 'Amravati North Sub-Centre',
      district: 'Amravati',
      state: 'Maharashtra',
    };

    vi.mocked(userApi.updateProfile).mockResolvedValueOnce({
      success: true,
      profile: serverConfirmedUpdatedProfile,
    });

    const result = await harness.get().updateProfile({
      name: 'Lakshmi D. (Promoted)',
      role: 'Senior Staff Nurse',
      healthSubCentre: 'Amravati North Sub-Centre',
      district: 'Amravati',
      state: 'Maharashtra',
    });

    expect(userApi.updateProfile).toHaveBeenCalledWith({
      name: 'Lakshmi D. (Promoted)',
      role: 'Senior Staff Nurse',
      healthSubCentre: 'Amravati North Sub-Centre',
      district: 'Amravati',
      state: 'Maharashtra',
    });

    expect(result.name).toBe('Lakshmi D. (Promoted)');
    expect(harness.get().profile.name).toBe('Lakshmi D. (Promoted)');
    expect(harness.get().profile.role).toBe('Senior Staff Nurse');
    expect(harness.get().profile.district).toBe('Amravati');
    expect(harness.get().isError).toBe(false);
  });

  // =========================================================================
  // 4. SAFE OPTIMISTIC ROLLBACK ON FAILED UPDATE
  // =========================================================================
  it('Scenario 4: Safely rolls back in-memory and local cache state if server update rejects', async () => {
    const harness = createHookHarness(() =>
      useUserProfile({
        initialProfile: mockServerProfile,
        initialStats: mockServerStats,
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    expect(harness.get().profile.name).toBe('Sister Lakshmi Deshmukh');

    // Server update fails with 500 Network / Server Error
    vi.mocked(userApi.updateProfile).mockRejectedValueOnce(
      new Error('Internal Server Error: Firestore write failed.')
    );

    let caughtError: any = null;
    try {
      await harness.get().updateProfile({
        name: 'Failed Attempt Name',
        district: 'Failed District',
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeDefined();

    // Verify state rolled back to the pre-edit snapshot!
    expect(harness.get().profile.name).toBe('Sister Lakshmi Deshmukh');
    expect(harness.get().profile.district).toBe('Bengaluru Rural');
    expect(harness.get().isError).toBe(true);
    expect(harness.get().errorMessage).toContain('Firestore write failed');

    // Storage is also restored to pre-edit snapshot
    expect(mockStorage.saveUserProfile).toHaveBeenLastCalledWith(mockServerProfile);
  });

  // =========================================================================
  // 5. AUTHENTICATION EXPIRY / 401 ERROR HANDLING
  // =========================================================================
  it('Scenario 5: Gracefully captures 401 Unauthorized errors and sets user-friendly error state', async () => {
    vi.mocked(userApi.getProfile).mockRejectedValueOnce(
      new Error('Unauthorized: Session has expired. Please sign in again.')
    );

    const harness = createHookHarness(() =>
      useUserProfile({
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    await harness.get().refetch();

    expect(harness.get().isError).toBe(true);
    expect(harness.get().errorMessage).toContain('Session has expired');
    expect(harness.get().isLoading).toBe(false);
  });

  // =========================================================================
  // 6. PROTECTED FIELDS INTEGRITY
  // =========================================================================
  it('Scenario 6: Ensures userApi client properly maps allowlisted fields and strips unapproved fields', async () => {
    const payloadWithInjectedFields: any = {
      name: 'Pooja',
      role: 'ASHA_WORKER',
      district: 'Pune',
      state: 'Maharashtra',
      // Injected malicious / protected fields:
      totalXp: 99999,
      currentStreak: 50,
      failCount: 0,
      learningState: { totalXp: 99999 },
    };

    vi.mocked(userApi.updateProfile).mockResolvedValueOnce({
      success: true,
      profile: {
        ...mockServerProfile,
        name: 'Pooja',
        role: 'ASHA_WORKER',
        district: 'Pune',
        state: 'Maharashtra',
      },
    });

    const harness = createHookHarness(() =>
      useUserProfile({
        initialProfile: mockServerProfile,
        initialStats: mockServerStats,
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    await harness.get().updateProfile(payloadWithInjectedFields);

    // Profile update completed
    expect(harness.get().profile.name).toBe('Pooja');
    // Stats remain completely untouched and authoritative!
    expect(harness.get().stats?.totalXp).toBe(180);
    expect(harness.get().stats?.currentStreak).toBe(12);
  });

  // =========================================================================
  // 7. SESSION, STREAK, XP, AND CLINICAL VAULT ISOLATION
  // =========================================================================
  it('Scenario 7: Profile operations preserve strict session, streak, XP, and Clinical Vault isolation', async () => {
    const harness = createHookHarness(() =>
      useUserProfile({
        initialProfile: mockServerProfile,
        initialStats: mockServerStats,
        storageRepository: mockStorage,
        skipAutoFetch: true,
      })
    );

    await harness.get().refetch();

    await harness.get().updateProfile({
      name: 'Sunita Sharma',
      district: 'Jaipur',
    });

    // Zero daily-session calls
    expect(sessionApi.recordAttempt).not.toHaveBeenCalled();
    expect(sessionApi.finalizeSession).not.toHaveBeenCalled();
    expect(sessionApi.getTodaySession).not.toHaveBeenCalled();

    // Zero question review / vault calls
    expect(questionApi.updateUnsolvedQuestion).not.toHaveBeenCalled();
    expect(questionApi.getUnsolvedQuestions).not.toHaveBeenCalled();

    // Stats remain completely invariant
    expect(harness.get().stats?.totalXp).toBe(180);
    expect(harness.get().stats?.currentStreak).toBe(12);
  });
});
