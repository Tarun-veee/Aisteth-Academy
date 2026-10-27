import { UserProfileDoc, UserLearningState } from '../models/user.model.js';

export interface RawLeaderboardEntry {
  uid: string;
  username: string;
  displayName: string;
  totalXp: number;
  createdAt: any;
}

export interface IUserRepository {
  findByUid(uid: string): Promise<UserProfileDoc | null>;
  findByUsername(username: string): Promise<{ uid: string | null; status: string } | null>;
  reserveUsername(username: string, reservationId: string): Promise<boolean>;
  releaseUsername(username: string, reservationId: string, ownerUid?: string): Promise<void>;
  activateUsername(username: string, uid: string, reservationId?: string): Promise<void>;
  createUserProfile(profile: UserProfileDoc): Promise<void>;
  updateUserProfile(uid: string, updates: Partial<UserProfileDoc>): Promise<void>;
  deleteUserProfile?(uid: string): Promise<void>;
  updateLearningState(uid: string, updates: Partial<UserLearningState>): Promise<void>;
  getLeaderboardEntries(limit: number): Promise<RawLeaderboardEntry[]>;
  countEligibleParticipants(): Promise<number>;
  countUsersWithHigherXp(xp: number): Promise<number>;

  // Phase 1: Phone Identity & Reservation Methods
  findByPhoneNumber?(phoneNumber: string): Promise<{ uid: string | null; status: string } | null>;
  findProfileByPhoneNumber?(phoneNumber: string): Promise<UserProfileDoc | null>;
  reservePhoneNumber?(phoneNumber: string, reservationId: string): Promise<boolean>;
  releasePhoneNumber?(phoneNumber: string, reservationId: string, ownerUid?: string): Promise<void>;
  activatePhoneNumber?(phoneNumber: string, uid: string, reservationId?: string): Promise<void>;
}

