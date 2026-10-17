import { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, DEFAULT_USER_PROFILE } from '../models/user.types';
import { UserStats } from '../models/session.types';
import { userApi, UpdateUserProfilePayload } from '../api/userApi';
import {
  defaultStorageRepository,
  StorageRepository,
} from '../repositories/StorageRepository';

export interface UseUserProfileOptions {
  initialProfile?: UserProfile;
  initialStats?: UserStats;
  storageRepository?: StorageRepository;
  skipAutoFetch?: boolean;
}

export interface UseUserProfileResult {
  profile: UserProfile;
  stats: UserStats | null;
  isLoading: boolean;
  isSaving: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => Promise<void>;
  updateProfile: (updates: UpdateUserProfilePayload) => Promise<UserProfile>;
}

export function useUserProfile(options: UseUserProfileOptions = {}): UseUserProfileResult {
  const {
    initialProfile,
    initialStats = null,
    storageRepository = defaultStorageRepository,
    skipAutoFetch = false,
  } = options;

  const [profile, setProfile] = useState<UserProfile>(
    initialProfile || DEFAULT_USER_PROFILE
  );
  const [stats, setStats] = useState<UserStats | null>(initialStats);
  const [isLoading, setIsLoading] = useState<boolean>(!initialProfile);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep a ref to the latest confirmed server profile for rollback protection
  const confirmedProfileRef = useRef<UserProfile>(profile);

  // Update confirmedProfileRef when profile changes from server
  useEffect(() => {
    confirmedProfileRef.current = profile;
  }, [profile]);

  // Fetch authoritative profile from server (GET /api/v1/users/me)
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);

    try {
      const res = await userApi.getProfile();
      if (res && res.profile) {
        setProfile(res.profile);
        confirmedProfileRef.current = res.profile;
        if (res.stats) {
          setStats(res.stats);
        }

        // Server profile strictly takes precedence over stale local cache (Requirement 8)
        try {
          await storageRepository.saveUserProfile(res.profile);
          if (res.stats) {
            await storageRepository.saveUserStats(res.stats);
          }
        } catch {
          // Non-blocking storage cache write failure
        }
      }
    } catch (err: any) {
      console.warn('[useUserProfile] fetch error:', err);
      setIsError(true);
      setErrorMessage(err?.message || 'Failed to load user profile from server.');

      // Cache-first fallback on network error: keep existing profile if already loaded
    } finally {
      setIsLoading(false);
    }
  }, [storageRepository]);

  // Initial load: Cache-first bootstrap + server sync
  useEffect(() => {
    let isMounted = true;

    async function init() {
      // 1. If no initialProfile supplied, attempt fast cache read from storage
      if (!initialProfile) {
        try {
          const cached = await storageRepository.getUserProfile();
          if (isMounted && cached && cached.name) {
            setProfile(cached);
            confirmedProfileRef.current = cached;
            setIsLoading(false);
          }
        } catch {
          // Ignore cache read error, will proceed to server fetch
        }
      }

      // 2. Fetch authoritative profile from backend unless skipped
      if (!skipAutoFetch) {
        await fetchProfile();
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [initialProfile, skipAutoFetch, storageRepository, fetchProfile]);

  // Safe optimistic update with rollback (Requirement 5)
  const updateProfile = useCallback(
    async (updates: UpdateUserProfilePayload): Promise<UserProfile> => {
      setIsSaving(true);
      setIsError(false);
      setErrorMessage(null);

      // Snapshot confirmed state before optimistic mutation
      const rollbackProfile = { ...confirmedProfileRef.current };

      // Apply optimistic update to UI state
      const optimisticProfile: UserProfile = {
        ...rollbackProfile,
        ...(updates.name || updates.displayName
          ? { name: (updates.displayName || updates.name || '').trim() }
          : {}),
        ...(updates.role || updates.designation
          ? { role: (updates.designation || updates.role || '').trim() }
          : {}),
        ...(updates.district !== undefined ? { district: updates.district.trim() } : {}),
        ...(updates.state !== undefined ? { state: updates.state.trim() } : {}),
        ...(updates.healthSubCentre !== undefined || updates.centerName !== undefined
          ? {
              healthSubCentre: (updates.healthSubCentre || updates.centerName || '').trim(),
              centerName: (updates.healthSubCentre || updates.centerName || '').trim(),
            }
          : {}),
        ...(updates.email !== undefined || updates.optionalEmail !== undefined
          ? { email: (updates.optionalEmail || updates.email || '').trim() }
          : {}),
      };

      setProfile(optimisticProfile);

      try {
        // Also optimistically save to local cache
        await storageRepository.saveUserProfile(optimisticProfile);
      } catch {
        // Non-blocking local storage write
      }

      try {
        // Dispatch PATCH /api/v1/users/me with allow-listed fields
        const res = await userApi.updateProfile(updates);

        if (res && res.profile) {
          // Synchronize with server-confirmed authoritative profile
          setProfile(res.profile);
          confirmedProfileRef.current = res.profile;

          try {
            await storageRepository.saveUserProfile(res.profile);
          } catch {
            // Non-blocking local cache sync
          }

          setIsSaving(false);
          return res.profile;
        }

        setIsSaving(false);
        return optimisticProfile;
      } catch (err: any) {
        console.warn('[useUserProfile] update error, rolling back:', err);

        // Safe Rollback to pre-edit snapshot (Requirement 5)
        setProfile(rollbackProfile);
        confirmedProfileRef.current = rollbackProfile;

        try {
          await storageRepository.saveUserProfile(rollbackProfile);
        } catch {
          // Rollback local storage
        }

        setIsError(true);
        const msg = err?.message || 'Failed to update profile on server.';
        setErrorMessage(msg);
        setIsSaving(false);
        throw err;
      }
    },
    [storageRepository]
  );

  return {
    profile,
    stats,
    isLoading,
    isSaving,
    isError,
    errorMessage,
    refetch: fetchProfile,
    updateProfile,
  };
}
