import { useState, useEffect, useCallback, useRef } from 'react';
import { leaderboardApi } from '../api/leaderboardApi';
import { LeaderboardResponse } from '../models/leaderboard.types';

export interface UseLeaderboardResult {
  leaderboard: LeaderboardResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLeaderboard(limit = 50): UseLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await leaderboardApi.getLeaderboard(limit);
      if (isMountedRef.current) {
        setLeaderboard(response);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Unable to load leaderboard. Please try again.');
        setIsLoading(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchLeaderboard();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    isLoading,
    error,
    refetch: fetchLeaderboard,
  };
}
