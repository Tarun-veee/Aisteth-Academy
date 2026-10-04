import React from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Header } from '../components/common/Header';
import { UserStats, DailyProgressStatus, SESSION_CONFIG } from '../models/session.types';
import { PowerUpService } from '../services/PowerUpService';
import {
  Sparkles,
  Flame,
  Zap,
  CheckCircle2,
  Clock,
  ChevronRight,
  Stethoscope,
  BookOpen,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export interface HomeScreenProps {
  userStats: UserStats;
  dailyStatus?: DailyProgressStatus;
  currentQuestionIndex?: number;
  totalQuestionsCount?: number;
  onStartSession: () => void;
  onNavigateProfile?: () => void;
  onNavigatePowerUps?: () => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userStats,
  dailyStatus = 'NOT_STARTED',
  currentQuestionIndex = 0,
  totalQuestionsCount = SESSION_CONFIG.DEFAULT_SESSION_LENGTH,
  onStartSession,
  onNavigateProfile,
  onNavigatePowerUps,
  isLoading = false,
  isError = false,
  errorMessage = 'Unable to load your progress.',
  onRetry,
}) => {
  const powerUps = PowerUpService.calculateInventory(userStats);

  // Today's training lifecycle states
  const isCompleted = dailyStatus === 'REVIEW_VIEWED';
  const isReviewPending = dailyStatus === 'QUESTIONS_COMPLETED';
  const isInProgress = dailyStatus === 'IN_PROGRESS';

  let buttonText = "START TODAY'S TRAINING";
  let buttonIcon = <ChevronRight className="w-5 h-5 ml-0.5" />;
  const buttonDisabled = isLoading || isCompleted;

  if (isLoading) {
    buttonText = 'Loading Session...';
  } else if (isCompleted) {
    buttonText = "TODAY'S TRAINING COMPLETE";
    buttonIcon = <Check className="w-5 h-5 ml-0.5 text-status-success" />;
  } else if (isReviewPending) {
    buttonText = 'VIEW SESSION REVIEW';
    buttonIcon = <BookOpen className="w-5 h-5 ml-0.5" />;
  } else if (isInProgress) {
    buttonText = "CONTINUE TODAY'S TRAINING";
    buttonIcon = <ChevronRight className="w-5 h-5 ml-0.5" />;
  }

  // Render Skeleton Loading State to prevent layout jumps and flash of zero values
  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg select-none">
        <Header title="AiSteth Academy" streakCount={0} xpCount={0} />
        <main className="flex-1 p-4 sm:p-5 flex flex-col gap-4 max-w-md mx-auto w-full pb-8 animate-pulse">
          {/* Greeting Skeleton */}
          <div className="flex items-center justify-between pt-1">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-slate-200 rounded-full" />
              <div className="h-6 w-48 bg-slate-200 rounded-lg" />
              <div className="h-3.5 w-60 bg-slate-100 rounded-full" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-200 shrink-0" />
          </div>

          {/* Hero Card Skeleton */}
          <div className="h-56 rounded-3xl bg-slate-200 shadow-soft" />

          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="h-20 rounded-2xl bg-slate-200" />
            <div className="h-20 rounded-2xl bg-slate-200" />
            <div className="h-20 rounded-2xl bg-slate-200" />
          </div>
        </main>
      </div>
    );
  }

  // Render Error State with meaningful retry action
  if (isError) {
    return (
      <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg">
        <Header title="AiSteth Academy" streakCount={userStats.currentStreak} xpCount={userStats.totalXp} />
        <main className="flex-1 p-4 sm:p-5 flex flex-col items-center justify-center text-center gap-4 max-w-md mx-auto w-full pb-8">
          <div className="w-16 h-16 rounded-3xl bg-status-errorBg border-2 border-status-error flex items-center justify-center text-status-error shadow-soft">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-black text-content-primary">Unable to Load Progress</h2>
            <p className="text-xs sm:text-sm text-content-secondary mt-1 max-w-xs leading-relaxed">
              {errorMessage}
            </p>
          </div>
          {onRetry && (
            <Button
              variant="primary"
              size="md"
              onClick={onRetry}
              icon={<RefreshCw className="w-4 h-4 mr-1.5" />}
              className="font-bold min-h-[48px] px-6"
            >
              Try Again
            </Button>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg">
      {/* Top Header with 4 Clear Functional Actions */}
      <Header
        title="AiSteth Academy"
        streakCount={userStats.currentStreak}
        xpCount={userStats.totalXp}
        unlockedPowerUpsCount={powerUps.totalUnlockedCount}
        onNavigatePowerUps={onNavigatePowerUps}
        onNavigateProfile={onNavigateProfile}
      />

      <main className="flex-1 p-4 sm:p-5 flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
        {/* 1. Trainee Greeting Banner */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
              ASHA & Anganwadi Training
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-content-primary tracking-tight">
              Namaste, Trainee! 👋
            </h2>
            <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
              {isCompleted
                ? "You've completed your daily training mission. Great work!"
                : "Ready for today's stethoscope practice session?"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0 shadow-2xs">
            <Stethoscope className="w-6 h-6 text-brand-600" />
          </div>
        </div>

        {/* 2. Daily Mission Hero Card (Primary Focus) */}
        <Card
          variant="elevated"
          padding="lg"
          className={`bg-gradient-to-br ${
            isCompleted
              ? 'from-slate-700 to-slate-900'
              : 'from-brand-600 to-brand-800'
          } text-white border-none shadow-float relative overflow-hidden`}
        >
          {/* Subtle Background Glow */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <Badge
              variant="outline"
              size="sm"
              className="bg-white/15 text-white border-white/20 font-bold uppercase tracking-wider text-[11px]"
            >
              <Sparkles className="w-3 h-3 mr-1 text-amber-300 fill-amber-300" />
              {isCompleted ? 'Mission Finished' : 'Daily Mission'}
            </Badge>

            <span className="flex items-center text-xs font-medium text-blue-100 gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~5-10 mins
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black tracking-tight mb-1">
            Standard Auscultation Workflow
          </h3>
          <p className="text-xs sm:text-sm text-blue-100 mb-4 leading-relaxed">
            {isCompleted
              ? 'You have completed all 10 clinical & practical questions for today. Return tomorrow to extend your streak.'
              : `Complete ${totalQuestionsCount} practical & clinical questions to build confidence with AiSteth.`}
          </p>

          <div className="flex items-center justify-between bg-black/15 rounded-xl p-3 mb-4 text-xs font-semibold">
            <span className="text-blue-100">
              {isInProgress ? 'Current Progress:' : 'Session Length:'}
            </span>
            <span className="text-white font-bold">
              {isInProgress
                ? `Question ${currentQuestionIndex + 1} of ${totalQuestionsCount}`
                : `${totalQuestionsCount} Questions`}
            </span>
          </div>

          <Button
            variant="secondary"
            fullWidth
            size="lg"
            onClick={onStartSession}
            disabled={buttonDisabled}
            className={`font-bold shadow-md shadow-black/10 min-h-[54px] ${
              isCompleted
                ? 'bg-slate-200 text-slate-700 cursor-not-allowed opacity-90'
                : 'bg-white text-brand-800 hover:bg-blue-50 active:bg-blue-100'
            }`}
            icon={buttonIcon}
            iconPosition="right"
          >
            {buttonText}
          </Button>
        </Card>

        {/* 3. Compact User Progress Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Streak */}
          <Card padding="sm" className="flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
              <Flame className="w-4 h-4 fill-amber-500" />
            </div>
            <span className="text-base font-black text-content-primary">
              {userStats.currentStreak} {userStats.currentStreak === 1 ? 'Day' : 'Days'}
            </span>
            <span className="text-[11px] font-semibold text-content-secondary">Streak</span>
          </Card>

          {/* Total XP (Learning Points) */}
          <Card padding="sm" className="flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-1">
              <Zap className="w-4 h-4 fill-brand-600" />
            </div>
            <span className="text-base font-black text-content-primary">{userStats.totalXp}</span>
            <span className="text-[11px] font-semibold text-content-secondary">Points</span>
          </Card>

          {/* Questions Completed */}
          <Card padding="sm" className="flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 rounded-xl bg-green-50 text-status-success flex items-center justify-center mb-1">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-base font-black text-content-primary">
              {userStats.completedQuestionsCount}
            </span>
            <span className="text-[11px] font-semibold text-content-secondary">Completed</span>
          </Card>
        </div>

        {/* 4. Demo Content Notice */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-content-secondary leading-relaxed">
          <span className="font-bold text-content-primary">Phase 1 Development Prototype: </span>
          All questions and stethoscope recordings are demonstration content intended for software validation. Clinician validation is required before field deployment.
        </div>
      </main>
    </div>
  );
};
