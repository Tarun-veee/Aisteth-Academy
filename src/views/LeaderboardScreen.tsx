import React from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { UserStats } from '../models/session.types';
import { useLeaderboard } from '../hooks/useLeaderboard';
import {
  Trophy,
  Medal,
  Crown,
  Zap,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export interface LeaderboardScreenProps {
  userStats?: UserStats;
  onBack: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  userStats,
  onBack,
}) => {
  const { leaderboard, isLoading, error, refetch } = useLeaderboard(50);

  // Extract top 3 for podium (if available)
  const entries = leaderboard?.entries || [];
  const podiumEntries = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);

  const currentUser = leaderboard?.currentUser;
  const totalParticipants = leaderboard?.totalParticipants || 0;

  // Podium badge colors according to rank
  const getRankBadgeStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: <Crown className="w-4 h-4 text-amber-600 fill-amber-500" />,
          podiumBorder: 'border-amber-400 bg-gradient-to-b from-amber-50 to-white shadow-md shadow-amber-100',
          badgeText: 'text-amber-800',
        };
      case 2:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <Medal className="w-4 h-4 text-slate-500 fill-slate-400" />,
          podiumBorder: 'border-slate-300 bg-gradient-to-b from-slate-50 to-white shadow-md shadow-slate-100',
          badgeText: 'text-slate-700',
        };
      case 3:
        return {
          bg: 'bg-orange-100 text-orange-900 border-orange-300',
          icon: <Medal className="w-4 h-4 text-orange-600 fill-orange-500" />,
          podiumBorder: 'border-orange-300 bg-gradient-to-b from-orange-50 to-white shadow-md shadow-orange-100',
          badgeText: 'text-orange-800',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          icon: null,
          podiumBorder: 'border-slate-200 bg-white',
          badgeText: 'text-slate-600',
        };
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg select-none">
      <Header
        title="Leaderboard"
        showBack={true}
        onBack={onBack}
        streakCount={userStats?.currentStreak || 0}
        xpCount={userStats?.totalXp || 0}
      />

      <main className="flex-1 p-4 sm:p-5 flex flex-col gap-4 max-w-md mx-auto w-full pb-10">
        {/* Title & Community Description */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-bold uppercase tracking-wider mb-1">
              <Trophy className="w-3.5 h-3.5" />
              <span>Community Ranking</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-content-primary tracking-tight">
              Leaderboard
            </h2>
            <p className="text-xs text-content-secondary mt-0.5">
              Ranked by verified clinical learning points
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-600 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            aria-label="Refresh leaderboard"
            title="Refresh leaderboard"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="flex flex-col gap-3 animate-pulse" aria-label="Loading leaderboard">
            <div className="h-32 rounded-3xl bg-slate-200" />
            <div className="grid grid-cols-3 gap-2 h-44">
              <div className="h-full rounded-2xl bg-slate-200" />
              <div className="h-full rounded-2xl bg-slate-200" />
              <div className="h-full rounded-2xl bg-slate-200" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-16 rounded-2xl bg-slate-200" />
              <div className="h-16 rounded-2xl bg-slate-200" />
              <div className="h-16 rounded-2xl bg-slate-200" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <Card padding="lg" className="border-2 border-red-200 bg-red-50/60 text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-red-900 mb-1">Unable to Load Leaderboard</h3>
            <p className="text-xs text-red-700 mb-4 max-w-xs mx-auto leading-relaxed">{error}</p>
            <Button
              variant="primary"
              size="md"
              onClick={refetch}
              icon={<RefreshCw className="w-4 h-4 mr-1.5" />}
              className="bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-bold mx-auto"
            >
              Retry
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && entries.length === 0 && (
          <Card padding="lg" className="border border-slate-200 text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-content-primary mb-1">
              No Leaderboard Entries Available
            </h3>
            <p className="text-xs text-content-secondary max-w-xs mx-auto leading-relaxed">
              No eligible leaderboard participants are currently available. Check back once sessions are recorded.
            </p>
          </Card>
        )}

        {/* Success State */}
        {!isLoading && !error && entries.length > 0 && (
          <>
            {/* 1. Prominent "Your Standing" Card */}
            {currentUser && (
              <div
                className="rounded-3xl p-4 sm:p-5 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white shadow-soft relative overflow-hidden"
                aria-label="Your current leaderboard standing"
              >
                <div className="absolute top-0 right-0 -mr-6 -mt-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

                <div className="flex items-center justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                        Rank
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-white leading-none">
                        {currentUser.rank !== null ? `#${currentUser.rank}` : '—'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white truncate max-w-[170px] sm:max-w-[200px]">
                          {currentUser.displayName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-black uppercase text-blue-100 tracking-wide">
                          You
                        </span>
                      </div>
                      <p className="text-xs text-blue-200 mt-0.5">
                        {currentUser.username ? `@${currentUser.username}` : 'Healthcare Trainee'}
                      </p>
                    </div>
                  </div>

                  {/* Level & Points Pill */}
                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex items-center gap-1 text-xs font-bold bg-white/15 px-2.5 py-1 rounded-xl backdrop-blur-sm border border-white/20">
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>{currentUser.totalXp !== null ? `${currentUser.totalXp} XP` : '—'}</span>
                    </div>
                    <span className="text-[10px] text-blue-200 font-medium mt-1">
                      {currentUser.currentLevel !== null ? `Level ${currentUser.currentLevel}` : 'Unranked'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-200 font-medium relative z-10">
                  <span>
                    {totalParticipants > 0
                      ? `Ranked among ${totalParticipants} trainees`
                      : 'Verified Community Participant'}
                  </span>
                  <span>{currentUser.isInTopList ? 'In Top List' : 'Beyond Top 50'}</span>
                </div>
              </div>
            )}

            {/* 2. Top-Three Podium (When entries >= 1) */}
            {podiumEntries.length > 0 && (
              <section aria-label="Top three participants podium" className="pt-1">
                <div className="grid grid-cols-3 gap-2 items-end">
                  {/* Position 2 (Silver) */}
                  {podiumEntries[1] ? (
                    <div
                      className={`flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all ${
                        getRankBadgeStyle(podiumEntries[1].rank).podiumBorder
                      } ${podiumEntries[1].isCurrentUser ? 'ring-2 ring-brand-500' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs mb-1.5 shadow-2xs border border-slate-300">
                        {podiumEntries[1].rank}
                      </div>
                      <span className="text-xs font-bold text-content-primary line-clamp-1 w-full">
                        {podiumEntries[1].displayName}
                      </span>
                      {podiumEntries[1].username && (
                        <span className="text-[10px] text-content-secondary truncate w-full">
                          {`@${podiumEntries[1].username}`}
                        </span>
                      )}
                      <div className="mt-2 flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-brand-50 text-brand-700 text-[11px] font-black">
                        <Zap className="w-3 h-3 fill-brand-600" />
                        <span>{podiumEntries[1].totalXp}</span>
                      </div>
                      <span className="text-[9px] text-content-secondary mt-0.5 font-semibold">
                        {`Lvl ${podiumEntries[1].currentLevel}`}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Position 1 (Gold) - Elevated */}
                  {podiumEntries[0] && (
                    <div
                      className={`flex flex-col items-center text-center p-3.5 rounded-2xl border-2 -mt-2 transition-all ${
                        getRankBadgeStyle(podiumEntries[0].rank).podiumBorder
                      } ${podiumEntries[0].isCurrentUser ? 'ring-2 ring-brand-500' : ''}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-black text-sm mb-1.5 shadow-xs border border-amber-300">
                        <Crown className="w-4 h-4 text-amber-600 fill-amber-500" />
                      </div>
                      <span className="text-xs font-black text-content-primary line-clamp-1 w-full">
                        {podiumEntries[0].displayName}
                      </span>
                      {podiumEntries[0].username && (
                        <span className="text-[10px] text-content-secondary truncate w-full">
                          {`@${podiumEntries[0].username}`}
                        </span>
                      )}
                      <div className="mt-2 flex items-center gap-0.5 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black">
                        <Zap className="w-3.5 h-3.5 fill-amber-500" />
                        <span>{podiumEntries[0].totalXp}</span>
                      </div>
                      <span className="text-[10px] text-amber-700 mt-0.5 font-bold">
                        {`Level ${podiumEntries[0].currentLevel}`}
                      </span>
                    </div>
                  )}

                  {/* Position 3 (Bronze) */}
                  {podiumEntries[2] ? (
                    <div
                      className={`flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all ${
                        getRankBadgeStyle(podiumEntries[2].rank).podiumBorder
                      } ${podiumEntries[2].isCurrentUser ? 'ring-2 ring-brand-500' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-900 flex items-center justify-center font-black text-xs mb-1.5 shadow-2xs border border-orange-300">
                        {podiumEntries[2].rank}
                      </div>
                      <span className="text-xs font-bold text-content-primary line-clamp-1 w-full">
                        {podiumEntries[2].displayName}
                      </span>
                      {podiumEntries[2].username && (
                        <span className="text-[10px] text-content-secondary truncate w-full">
                          {`@${podiumEntries[2].username}`}
                        </span>
                      )}
                      <div className="mt-2 flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-brand-50 text-brand-700 text-[11px] font-black">
                        <Zap className="w-3 h-3 fill-brand-600" />
                        <span>{podiumEntries[2].totalXp}</span>
                      </div>
                      <span className="text-[9px] text-content-secondary mt-0.5 font-semibold">
                        {`Lvl ${podiumEntries[2].currentLevel}`}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              </section>
            )}

            {/* 3. Ranked Participants List (Ranks 4+) */}
            {remainingEntries.length > 0 && (
              <section aria-label="Participant ranking list" className="pt-2">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-xs font-bold text-content-secondary uppercase tracking-wider">
                    Rankings
                  </h3>
                  <span className="text-[11px] text-content-secondary">
                    Showing top {entries.length}
                  </span>
                </div>

                <ol className="flex flex-col gap-2 list-none p-0 m-0">
                  {remainingEntries.map((entry) => {
                    const isUser = entry.isCurrentUser;
                    return (
                      <li key={`${entry.rank}_${entry.displayName}_${entry.totalXp}`}>
                        <Card
                          padding="sm"
                          className={`flex items-center justify-between gap-3 transition-all ${
                            isUser
                              ? 'border-2 border-brand-500 bg-brand-50/70 shadow-xs'
                              : 'border border-slate-200/90 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Rank Badge */}
                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-content-primary shrink-0">
                              {`#${entry.rank}`}
                            </div>

                            {/* Participant Name & Username */}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-content-primary truncate">
                                  {entry.displayName}
                                </span>
                                {isUser && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-brand-600 text-[9px] font-black text-white uppercase tracking-wider">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-content-secondary truncate">
                                {entry.username ? `@${entry.username}` : `Level ${entry.currentLevel}`}
                              </p>
                            </div>
                          </div>

                          {/* XP and Level */}
                          <div className="flex flex-col items-end shrink-0">
                            <div className="flex items-center gap-1 text-xs font-black text-brand-700 bg-brand-50 border border-brand-200/70 px-2 py-0.5 rounded-lg">
                              <Zap className="w-3 h-3 fill-brand-600" />
                              <span>{`${entry.totalXp} XP`}</span>
                            </div>
                            <span className="text-[10px] text-content-secondary font-medium mt-0.5">
                              {`Lvl ${entry.currentLevel}`}
                            </span>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};
