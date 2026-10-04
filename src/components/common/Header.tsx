import React from 'react';
import { ChevronLeft, Flame, Zap, Sparkles, User } from 'lucide-react';

export interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  streakCount?: number;
  xpCount?: number;
  unlockedPowerUpsCount?: number;
  onNavigateProfile?: () => void;
  onNavigatePowerUps?: () => void;
  isOffline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'AiSteth Academy',
  onBack,
  showBack = false,
  streakCount = 0,
  xpCount = 0,
  unlockedPowerUpsCount,
  onNavigateProfile,
  onNavigatePowerUps,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-surface-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3 sm:px-4 py-2 select-none">
      <div className="flex items-center justify-between gap-1.5 max-w-md mx-auto w-full">
        {/* Left: Back Action or App Logo */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {showBack && onBack ? (
            <button
              onClick={onBack}
              className="p-2 -ml-1 rounded-xl text-content-secondary hover:bg-slate-100 active:bg-slate-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Go Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : null}

          <h1 className="text-sm sm:text-base font-bold text-brand-900 tracking-tight flex items-center gap-1.5 truncate">
            <img
              src="/assets/images/aisteth_logo.png"
              alt="AiSteth"
              className="w-5 h-5 sm:w-5.5 sm:h-5.5 object-contain shrink-0 rounded-xs"
            />
            <span className="truncate">{title}</span>
          </h1>
        </div>

        {/* Right: Exactly 4 Items (Streak, Learning Points, Power-Ups, Profile) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 1. Streak Status Indicator */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs font-bold shrink-0 min-h-[36px]"
            title={`Active streak: ${streakCount} ${streakCount === 1 ? 'day' : 'days'}`}
            aria-label={`Current streak: ${streakCount} days`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
            <span>{streakCount}</span>
          </div>

          {/* 2. Learning Points Status Indicator */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-brand-50 border border-brand-200/90 text-brand-900 text-xs font-bold shrink-0 min-h-[36px]"
            title={`Learning Points: ${xpCount}`}
            aria-label={`Learning Points: ${xpCount}`}
          >
            <Zap className="w-3.5 h-3.5 text-brand-600 fill-brand-600 shrink-0" />
            <span>{xpCount}</span>
          </div>

          {/* 3. Power-Ups Icon Button (Navigates to Power-Ups Screen) */}
          {onNavigatePowerUps && (
            <button
              type="button"
              onClick={onNavigatePowerUps}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 active:bg-amber-200 text-amber-700 flex items-center justify-center transition-all relative cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 active:scale-95 shrink-0 min-w-[44px] min-h-[44px]"
              aria-label="Power-Ups"
              title={`Power-Ups (${unlockedPowerUpsCount || 0} Unlocked)`}
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              {typeof unlockedPowerUpsCount === 'number' && unlockedPowerUpsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-2xs">
                  {unlockedPowerUpsCount}
                </span>
              )}
            </button>
          )}

          {/* 4. Profile Icon Button (Navigates to Profile Screen) */}
          {onNavigateProfile && (
            <button
              type="button"
              onClick={onNavigateProfile}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 active:scale-95 shrink-0 min-w-[44px] min-h-[44px]"
              aria-label="My Profile"
              title="My Profile"
            >
              <User className="w-4 h-4 text-slate-700" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
