import { IUserRepository, RawLeaderboardEntry } from '../../domain/interfaces/IUserRepository.js';
import { ProgressionService } from '../../domain/rules/ProgressionService.js';
import {
  LeaderboardResponseDTO,
  LeaderboardEntryDTO,
  CurrentUserStandingDTO,
} from '../dtos/leaderboard.dto.js';

export class LeaderboardUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(currentUserUid: string, limit: number = 50): Promise<LeaderboardResponseDTO> {
    if (!currentUserUid || typeof currentUserUid !== 'string' || !currentUserUid.trim()) {
      throw new Error('User ID is required.');
    }

    const userProfile = await this.userRepo.findByUid(currentUserUid);
    if (!userProfile) {
      throw new Error(`USER_NOT_FOUND: User document for uid '${currentUserUid}' does not exist.`);
    }

    // Concurrently fetch raw top entries, total participants, and higher XP count (if trainee with valid XP)
    const rawUserXp = userProfile.learningState?.totalXp;
    const hasValidXp = ProgressionService.isValidXp(rawUserXp);
    const isTrainee = userProfile.role === 'TRAINEE';

    const [rawEntries, totalParticipants, higherXpCount] = await Promise.all([
      this.userRepo.getLeaderboardEntries(limit),
      this.userRepo.countEligibleParticipants(),
      isTrainee && hasValidXp ? this.userRepo.countUsersWithHigherXp(rawUserXp) : Promise.resolve(0),
    ]);

    // Defense-in-depth: Filter out any entries with invalid XP
    const validRawEntries = rawEntries.filter((entry) => ProgressionService.isValidXp(entry.totalXp));

    // Deterministic in-memory sort:
    // 1. totalXp descending
    // 2. createdAt ascending
    // 3. username ascending
    const sortedEntries: RawLeaderboardEntry[] = [...validRawEntries].sort((a, b) => {
      if (b.totalXp !== a.totalXp) {
        return b.totalXp - a.totalXp;
      }
      const aTime = a.createdAt?.toMillis
        ? a.createdAt.toMillis()
        : a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAt?.toMillis
        ? b.createdAt.toMillis()
        : b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return (a.username || '').localeCompare(b.username || '');
    });

    // Assign standard competition ranks (1, 2, 2, 4)
    let currentRank = 1;
    let isInTopList = false;
    const entries: LeaderboardEntryDTO[] = [];

    for (let i = 0; i < sortedEntries.length; i++) {
      const item = sortedEntries[i];
      if (i > 0 && item.totalXp < sortedEntries[i - 1].totalXp) {
        currentRank = i + 1; // 1-indexed rank skips positions occupied by ties
      }

      const isCurrent = item.uid === currentUserUid;
      if (isCurrent) {
        isInTopList = true;
      }

      const rawName = item.displayName?.trim();
      const displayName = rawName || (item.username ? `@${item.username}` : 'Healthcare Trainee');
      const level = ProgressionService.calculateLevel(item.totalXp);

      entries.push({
        rank: currentRank,
        displayName,
        ...(item.username ? { username: item.username } : {}),
        totalXp: item.totalXp,
        currentLevel: level,
        isCurrentUser: isCurrent,
      });
    }

    // Build CurrentUserStanding
    const currentRawName = userProfile.displayName?.trim();
    const currentDisplayName = currentRawName || (userProfile.username ? `@${userProfile.username}` : 'Healthcare Trainee');

    let finalUserRank: number | null = null;
    let currentUserStandingXp: number | null = null;
    let currentUserStandingLevel: number | null = null;

    if (hasValidXp) {
      currentUserStandingXp = rawUserXp;
      currentUserStandingLevel = ProgressionService.calculateLevel(rawUserXp);
      if (isTrainee) {
        if (isInTopList) {
          const found = entries.find((e) => e.isCurrentUser);
          finalUserRank = found ? found.rank : higherXpCount + 1;
        } else {
          finalUserRank = higherXpCount + 1;
        }
      }
    }

    const currentUserStanding: CurrentUserStandingDTO = {
      rank: finalUserRank,
      displayName: currentDisplayName,
      ...(userProfile.username ? { username: userProfile.username } : {}),
      totalXp: currentUserStandingXp,
      currentLevel: currentUserStandingLevel,
      isInTopList,
    };

    return {
      success: true,
      entries,
      currentUser: currentUserStanding,
      totalParticipants,
      returnedCount: entries.length,
    };
  }
}
