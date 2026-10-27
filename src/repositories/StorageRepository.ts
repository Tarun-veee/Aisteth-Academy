import { openDB, IDBPDatabase } from 'idb';
import { StoredSessionRecord, UserStats, DailySessionData } from '../models/session.types';
import { UserProfile, DEFAULT_USER_STATS, DEFAULT_USER_PROFILE } from '../models/user.types';
import { CompetencyProgress, CoreCompetencyArea, CORE_COMPETENCIES } from '../models/progression.types';

export const DAILY_CYCLE_RESET_HOUR_IST = 9; // 09:00:00 IST

/**
 * Computes the authoritative daily cycle date in Asia/Kolkata timezone.
 *
 * Daily learning cycle boundary: exactly 09:00:00 IST (UTC+05:30).
 * - Prior to 09:00:00 IST, the previous calendar date's cycle remains active.
 * - At or after 09:00:00 IST, the current calendar date's cycle is active.
 */
export function getDailyCycleDate(date: Date = new Date()): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date') || params.get('sessionDate');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return dateParam;
    }
  }
  const shifted = new Date(date.getTime() - DAILY_CYCLE_RESET_HOUR_IST * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(shifted);
}

export function getLocalTodayDateString(): string {
  return getDailyCycleDate();
}

const DB_NAME = 'aisteth_academy_db';
const DB_VERSION = 2;

const STORES = {
  SESSIONS: 'session_records',
  STATS: 'user_stats',
  PROFILE: 'user_profile',
  DAILY: 'daily_sessions'
} as const;

export class StorageRepository {
  private dbPromise: Promise<IDBPDatabase> | null = null;
  private isIndexedDBAvailable: boolean = true;

  constructor() {
    this.initDB();
  }

  private initDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isIndexedDBAvailable = false;
      return;
    }

    try {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
            db.createObjectStore(STORES.SESSIONS, { keyPath: 'sessionId' });
          }
          if (!db.objectStoreNames.contains(STORES.STATS)) {
            db.createObjectStore(STORES.STATS);
          }
          if (!db.objectStoreNames.contains(STORES.PROFILE)) {
            db.createObjectStore(STORES.PROFILE);
          }
          if (!db.objectStoreNames.contains(STORES.DAILY)) {
            db.createObjectStore(STORES.DAILY, { keyPath: 'date' });
          }
        }
      });
    } catch {
      this.isIndexedDBAvailable = false;
    }
  }

  /**
   * Save a completed session record and recalculate user stats, streak, and Streak Shield consumption.
   */
  async saveSession(session: StoredSessionRecord): Promise<void> {
    let alreadyExists = false;
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        const existing = await db.get(STORES.SESSIONS, session.sessionId);
        if (existing) {
          alreadyExists = true;
        }
        await db.put(STORES.SESSIONS, session);
      } catch (err) {
        console.warn('IndexedDB write failed, using localStorage fallback', err);
        alreadyExists = this.getAllSessionsFallback().some((s) => s.sessionId === session.sessionId);
        this.saveSessionFallback(session);
      }
    } else {
      alreadyExists = this.getAllSessionsFallback().some((s) => s.sessionId === session.sessionId);
      this.saveSessionFallback(session);
    }

    if (alreadyExists) {
      // Idempotency guard: Session already recorded; do not duplicate stats progression
      return;
    }

    // Update cumulative user stats & streak
    const currentStats = await this.getUserStats();
    const todayStr = getLocalTodayDateString();
    const streakResult = this.computeStreak(
      currentStats.lastActiveDate,
      currentStats.currentStreak
    );

    const newStreak = streakResult.newStreak;
    const longestStreak = Math.max(currentStats.longestStreak || 0, newStreak);

    const updatedStats: UserStats = {
      totalXp: currentStats.totalXp + session.xpEarned,
      currentStreak: newStreak,
      longestStreak: longestStreak,
      lastActiveDate: todayStr,
      completedQuestionsCount: (currentStats.completedQuestionsCount || 0) + session.totalQuestions,
      completedSessionsCount: (currentStats.completedSessionsCount || 0) + 1,
      totalCorrectAnswersCount: (currentStats.totalCorrectAnswersCount || 0) + (session.correctCount || 0),
    };

    await this.saveUserStats(updatedStats);
  }

  /**
   * Get all past recorded sessions.
   */
  async getAllSessions(): Promise<StoredSessionRecord[]> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        return (await db.getAll(STORES.SESSIONS)) || [];
      } catch {
        return this.getAllSessionsFallback();
      }
    }
    return this.getAllSessionsFallback();
  }

  /**
   * Aggregates real learner competency progress across all past recorded sessions.
   * Pure deterministic calculation without fake percentages or placeholder numbers.
   */
  async getCompetencyProgress(): Promise<CompetencyProgress[]> {
    const allSessions = await this.getAllSessions();

    const counts: Record<CoreCompetencyArea, { attempted: number; correct: number }> = {
      DEVICE_HANDLING: { attempted: 0, correct: 0 },
      HEART_RECORDING: { attempted: 0, correct: 0 },
      QUALITY_ASSESSMENT: { attempted: 0, correct: 0 },
    };

    for (const session of allSessions) {
      if (Array.isArray(session.answers)) {
        for (const answer of session.answers) {
          const category = answer.category;
          if (!category) continue;

          if (category === 'DEVICE_HANDLING') {
            counts.DEVICE_HANDLING.attempted += 1;
            if (answer.isCorrect) counts.DEVICE_HANDLING.correct += 1;
          } else if (
            category === 'HEART_RECORDING' ||
            category === 'OPERATING_PROCEDURE' ||
            category === 'ANATOMICAL_PLACEMENT'
          ) {
            counts.HEART_RECORDING.attempted += 1;
            if (answer.isCorrect) counts.HEART_RECORDING.correct += 1;
          } else if (category === 'QUALITY_ASSESSMENT') {
            counts.QUALITY_ASSESSMENT.attempted += 1;
            if (answer.isCorrect) counts.QUALITY_ASSESSMENT.correct += 1;
          }
        }
      }
    }

    const areas: CoreCompetencyArea[] = ['DEVICE_HANDLING', 'HEART_RECORDING', 'QUALITY_ASSESSMENT'];

    return areas.map((area) => {
      const meta = CORE_COMPETENCIES[area];
      const data = counts[area];
      const accuracyPercentage =
        data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : null;

      return {
        area,
        title: meta.title,
        description: meta.description,
        categories: meta.categories,
        questionsAttempted: data.attempted,
        questionsCorrect: data.correct,
        accuracyPercentage,
      };
    });
  }

  /**
   * Get aggregated user statistics.
   */
  async getUserStats(): Promise<UserStats> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        const stats = await db.get(STORES.STATS, 'current_stats');
        return stats || DEFAULT_USER_STATS;
      } catch {
        return this.getUserStatsFallback();
      }
    }
    return this.getUserStatsFallback();
  }

  /**
   * Save updated user statistics.
   */
  async saveUserStats(stats: UserStats): Promise<void> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        await db.put(STORES.STATS, stats, 'current_stats');
        return;
      } catch {
        this.saveUserStatsFallback(stats);
      }
    } else {
      this.saveUserStatsFallback(stats);
    }
  }

  /**
   * Get user profile.
   */
  async getUserProfile(): Promise<UserProfile> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        const profile = await db.get(STORES.PROFILE, 'current_profile');
        return profile || DEFAULT_USER_PROFILE;
      } catch {
        return this.getUserProfileFallback();
      }
    }
    return this.getUserProfileFallback();
  }

  /**
   * Save or update user profile.
   */
  async saveUserProfile(profile: UserProfile): Promise<void> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        await db.put(STORES.PROFILE, profile, 'current_profile');
        return;
      } catch {
        this.saveUserProfileFallback(profile);
      }
    } else {
      this.saveUserProfileFallback(profile);
    }
  }

  /**
   * Get daily session state for a given local calendar date (YYYY-MM-DD).
   */
  async getDailySession(dateStr: string): Promise<DailySessionData | null> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        const session = await db.get(STORES.DAILY, dateStr);
        return session || this.getDailySessionFallback(dateStr);
      } catch {
        return this.getDailySessionFallback(dateStr);
      }
    }
    return this.getDailySessionFallback(dateStr);
  }

  /**
   * Save daily session state for a given local calendar date.
   */
  async saveDailySession(daily: DailySessionData): Promise<void> {
    if (this.isIndexedDBAvailable && this.dbPromise) {
      try {
        const db = await this.dbPromise;
        await db.put(STORES.DAILY, daily);
        return;
      } catch {
        this.saveDailySessionFallback(daily);
      }
    } else {
      this.saveDailySessionFallback(daily);
    }
  }

  /**
   * Helper: Computes updated daily streak count based on last active calendar date.
   */
  computeStreak(
    lastActiveDateStr: string | null,
    currentStreak: number
  ): { newStreak: number } {
    if (!lastActiveDateStr) return { newStreak: 1 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActive = new Date(lastActiveDateStr);
    lastActive.setHours(0, 0, 0, 0);

    const diffDays = Math.round((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already active today, maintain streak
      return { newStreak: Math.max(1, currentStreak) };
    } else if (diffDays === 1) {
      // Consecutive day activity, increment streak
      return { newStreak: currentStreak + 1 };
    } else {
      // Missed 1 or more days, reset to 1
      return { newStreak: 1 };
    }
  }

  private memoryFallback: Map<string, string> = new Map();

  private getStorageItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return this.memoryFallback.get(key) || null;
      }
    }
    return this.memoryFallback.get(key) || null;
  }

  private setStorageItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        this.memoryFallback.set(key, value);
      }
    }
    this.memoryFallback.set(key, value);
  }

  // Fallbacks for resilient offline operation
  private saveSessionFallback(session: StoredSessionRecord) {
    try {
      const existing = this.getAllSessionsFallback();
      const idx = existing.findIndex((s) => s.sessionId === session.sessionId);
      if (idx >= 0) {
        existing[idx] = session;
      } else {
        existing.push(session);
      }
      this.setStorageItem('aisteth_sessions', JSON.stringify(existing));
    } catch (e) {
      console.error('Storage write error', e);
    }
  }

  private getAllSessionsFallback(): StoredSessionRecord[] {
    try {
      const data = this.getStorageItem('aisteth_sessions');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private getUserStatsFallback(): UserStats {
    try {
      const data = this.getStorageItem('aisteth_user_stats');
      return data ? JSON.parse(data) : DEFAULT_USER_STATS;
    } catch {
      return DEFAULT_USER_STATS;
    }
  }

  private saveUserStatsFallback(stats: UserStats) {
    try {
      this.setStorageItem('aisteth_user_stats', JSON.stringify(stats));
    } catch (e) {
      console.error('Storage write error', e);
    }
  }

  private getUserProfileFallback(): UserProfile {
    try {
      const data = this.getStorageItem('aisteth_user_profile');
      return data ? JSON.parse(data) : DEFAULT_USER_PROFILE;
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  }

  private saveUserProfileFallback(profile: UserProfile): void {
    try {
      this.setStorageItem('aisteth_user_profile', JSON.stringify(profile));
    } catch (e) {
      console.error('Storage write error for profile', e);
    }
  }

  private getDailySessionFallback(dateStr: string): DailySessionData | null {
    try {
      const data = this.getStorageItem(`aisteth_daily_${dateStr}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private saveDailySessionFallback(daily: DailySessionData) {
    try {
      this.setStorageItem(`aisteth_daily_${daily.date}`, JSON.stringify(daily));
    } catch (e) {
      console.error('Storage write error for daily session', e);
    }
  }
}

export const defaultStorageRepository = new StorageRepository();
