import React from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SessionState } from '../models/session.types';
import {
  Trophy,
  Zap,
  CheckCircle2,
  XCircle,
  Home,
  BookOpen,
  ChevronRight
} from 'lucide-react';

export interface SessionSummaryScreenProps {
  session: SessionState;
  onReturnHome: () => void;
  onReviewAnswers: () => void;
}

export const SessionSummaryScreen: React.FC<SessionSummaryScreenProps> = ({
  session,
  onReturnHome,
  onReviewAnswers,
}) => {
  const total = session.questions.length;
  const correct = session.correctCount;
  const incorrect = total - correct;
  const percentage = Math.round((correct / total) * 100);

  const isHighPass = percentage >= 80;

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-5 max-w-md mx-auto w-full justify-between">
      <div className="flex flex-col gap-4">
        {/* Top Trophy Banner */}
        <div className="text-center pt-4 pb-2">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-brand-50 border-2 border-brand-200 flex items-center justify-center text-brand-600 shadow-float mb-3">
            <Trophy className="w-9 h-9 sm:w-11 sm:h-11 text-amber-500 fill-amber-400" />
          </div>

          <Badge variant={isHighPass ? 'success' : 'brand'} size="sm" className="mb-1 font-bold">
            {isHighPass ? 'EXCELLENT WORK' : 'TRAINING COMPLETE'}
          </Badge>

          <h2 className="text-2xl sm:text-3xl font-black text-content-primary tracking-tight">
            Daily Mission Complete!
          </h2>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            You have successfully completed today's clinical stethoscope training.
          </p>
        </div>

        {/* Big Score Card */}
        <Card
          variant="elevated"
          padding="lg"
          className="bg-gradient-to-br from-brand-600 to-brand-800 text-white border-none shadow-float text-center relative overflow-hidden"
        >
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-lg pointer-events-none" />

          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
            Competency Score
          </span>

          <div className="my-2">
            <span className="text-4xl sm:text-5xl font-black tracking-tight">{percentage}%</span>
            <span className="text-sm font-semibold text-blue-200 ml-1">
              ({correct}/{total} Correct)
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white mt-1">
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>+{session.totalXpEarned} Total XP Awarded</span>
          </div>
        </Card>

        {/* Detailed Statistics Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card padding="md" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-successBg text-status-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-black text-content-primary block leading-none">
                {correct}
              </span>
              <span className="text-xs font-semibold text-content-secondary">Correct</span>
            </div>
          </Card>

          <Card padding="md" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-errorBg text-status-error flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-black text-content-primary block leading-none">
                {incorrect}
              </span>
              <span className="text-xs font-semibold text-content-secondary">Incorrect</span>
            </div>
          </Card>
        </div>

        {/* Quick Review Prompt Card */}
        <button
          type="button"
          onClick={onReviewAnswers}
          className="w-full p-4 bg-surface-white rounded-2xl border-2 border-slate-200 hover:border-brand-500 active:scale-[0.99] flex items-center justify-between text-left transition-all shadow-soft group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-content-primary group-hover:text-brand-600 transition-colors">
                Review Questions & Clinical Rationale
              </h4>
              <p className="text-xs text-content-secondary">
                Inspect correct answers and micro-learning notes
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-content-muted group-hover:text-brand-600 transition-colors" />
        </button>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex flex-col gap-2.5 pt-4 pb-2">
        <Button
          variant="primary"
          fullWidth
          size="lg"
          onClick={onReturnHome}
          icon={<Home className="w-5 h-5 mr-1" />}
          className="font-bold min-h-[54px]"
        >
          RETURN HOME
        </Button>
      </div>
    </div>
  );
};
