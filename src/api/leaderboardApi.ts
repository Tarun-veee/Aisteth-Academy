import { apiFetch } from './client';
import { LeaderboardResponse } from '../models/leaderboard.types';

export const leaderboardApi = {
  /**
   * Fetch leaderboard entries and current user's authoritative standing.
   * Target endpoint: GET /api/v1/users/leaderboard?limit={limit}
   */
  async getLeaderboard(limit = 50): Promise<LeaderboardResponse> {
    return apiFetch<LeaderboardResponse>(`/users/leaderboard?limit=${limit}`, {
      method: 'GET',
    });
  },
};
