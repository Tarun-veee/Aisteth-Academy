export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  username?: string;
  totalXp: number;
  currentLevel: number;
  isCurrentUser: boolean;
}

export interface CurrentUserStanding {
  rank: number | null;
  displayName: string;
  username?: string;
  totalXp: number | null;
  currentLevel: number | null;
  isInTopList: boolean;
}

export interface LeaderboardResponse {
  success: true;
  entries: LeaderboardEntry[];
  currentUser: CurrentUserStanding;
  totalParticipants: number;
  returnedCount: number;
}
