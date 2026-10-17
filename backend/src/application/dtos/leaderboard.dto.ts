export interface LeaderboardEntryDTO {
  rank: number;
  displayName: string;
  username?: string;
  totalXp: number;
  currentLevel: number;
  isCurrentUser: boolean;
}

export interface CurrentUserStandingDTO {
  rank: number | null;
  displayName: string;
  username?: string;
  totalXp: number | null;
  currentLevel: number | null;
  isInTopList: boolean;
}

export interface LeaderboardResponseDTO {
  success: true;
  entries: LeaderboardEntryDTO[];
  currentUser: CurrentUserStandingDTO;
  totalParticipants: number;
  returnedCount: number;
}
