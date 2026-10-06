import React from 'react';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { UserStats } from '../models/session.types';
import { PowerUpService } from '../services/PowerUpService';
import {
  Lightbulb,
  ShieldCheck,
  Shield,
  Check,
  Lock,
  Sparkles
} from 'lucide-react';

export interface PowerUpsScreenProps {
  userStats: UserStats;
  onBack: () => void;
}

export const PowerUpsScreen: React.FC<PowerUpsScreenProps> = ({
  userStats,
  onBack,
}) => {
  const powerUps = PowerUpService.calculateInventory(userStats);

  // Exactly three official power-ups (HINT and RETRY are permanently removed)
  const tools = [
    {
      id: 'FIFTY_FIFTY' as const,
      name: '50/50',
      iconEmoji: '⚡',
      icon: <Sparkles className="w-5 h-5" />,
      description: 'Removes 2 incorrect options',
      item: powerUps.items.find((i) => i.id === 'FIFTY_FIFTY'),
      lockedLabel: `Unlock at a 20-day streak (${userStats.currentStreak || 0}/20)`,
    },
    {
      id: 'LEARN' as const,
      name: 'Learn',
      iconEmoji: '📖',
      icon: <Lightbulb className="w-5 h-5" />,
      description: 'Shows the learning objective',
      item: powerUps.items.find((i) => i.id === 'LEARN'),
      lockedLabel: `Unlock after 100 answered questions (${userStats.completedQuestionsCount || 0}/100)`,
    },
    {
      id: 'STREAK_SHIELD' as const,
      name: 'Streak Shield',
      iconEmoji: '🛡',
      icon: <ShieldCheck className="w-5 h-5" />,
      description: 'Protects one missed day',
      item: powerUps.streakShield,
      lockedLabel: `Unlock at a 30-day streak (${userStats.currentStreak || 0}/30)`,
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg select-none">
      {/* 1. Header: Simple "Power-Ups" with Back Navigation */}
      <Header
        title="Power-Ups"
        showBack={true}
        onBack={onBack}
      />

      <main className="flex-1 px-3.5 sm:px-4 py-3 sm:py-3.5 flex flex-col gap-3 max-w-md mx-auto w-full pb-6">
        {/* Banner Guidance */}
        <div className="flex items-center gap-3 p-3.5 bg-brand-50/80 border border-brand-200/90 rounded-2xl shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-brand-950 leading-tight">
              My Learning Tools
            </h2>
            <p className="text-xs text-brand-800/90 mt-0.5 leading-snug">
              Use these tools while learning to help answer questions.
            </p>
          </div>
        </div>

        {/* Exactly 3 Power-Up Cards */}
        <div className="flex flex-col gap-2.5">
          {tools.map((tool) => {
            const isUnlocked = tool.item?.isUnlocked ?? false;
            const isConsumed = tool.item?.status === 'CONSUMED';

            return (
              <Card
                key={tool.id}
                variant="default"
                padding="md"
                className={`p-3.5 rounded-2xl border transition-all ${
                  isUnlocked
                    ? isConsumed
                      ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                      : 'bg-white border-brand-200/90 text-brand-950 shadow-soft'
                    : 'bg-slate-50/80 border-slate-200/90 text-content-secondary'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Icon and Name/Description */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isUnlocked
                          ? isConsumed
                            ? 'bg-amber-500 text-white'
                            : 'bg-brand-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {isUnlocked ? (
                        tool.id === 'STREAK_SHIELD' ? (
                          <ShieldCheck className="w-5 h-5" />
                        ) : (
                          tool.icon
                        )
                      ) : tool.id === 'STREAK_SHIELD' ? (
                        <Shield className="w-5 h-5" />
                      ) : (
                        <Lock className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-content-primary truncate">
                          {tool.iconEmoji} {tool.name}
                        </span>
                      </div>
                      <p className="text-xs text-content-secondary mt-0.5 leading-relaxed">
                        {isUnlocked ? tool.description : tool.lockedLabel}
                      </p>
                    </div>
                  </div>

                  {/* Right: Clean Status Badge */}
                  <div className="shrink-0 mt-0.5">
                    {isUnlocked ? (
                      isConsumed ? (
                        <Badge
                          variant="warning"
                          size="sm"
                          className="text-[11px] font-bold px-2 py-0.5 flex items-center gap-1 whitespace-nowrap shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Used</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="success"
                          size="sm"
                          className="text-[11px] font-bold px-2 py-0.5 flex items-center gap-1 whitespace-nowrap shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Available</span>
                        </Badge>
                      )
                    ) : (
                      <Badge
                        variant="neutral"
                        size="sm"
                        className="text-[11px] font-bold px-2 py-0.5 flex items-center gap-1 text-slate-500 whitespace-nowrap"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};
