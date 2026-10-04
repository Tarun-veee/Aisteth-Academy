import React from 'react';
import { CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Badge } from '../common/Badge';

export interface ResultBannerProps {
  isCorrect: boolean;
  awardedXp: number;
}

export const ResultBanner: React.FC<ResultBannerProps> = ({ isCorrect, awardedXp }) => {
  return (
    <div className="flex items-center justify-between gap-2.5 w-full">
      <div className="flex items-center gap-2.5">
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
            isCorrect
              ? 'bg-status-success text-white'
              : 'bg-status-error text-white'
          }`}
        >
          {isCorrect ? (
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          ) : (
            <XCircle className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          )}
        </div>

        <div>
          <h3
            className={`text-base sm:text-lg font-bold tracking-tight leading-tight ${
              isCorrect ? 'text-status-success' : 'text-status-error'
            }`}
          >
            {isCorrect ? 'Correct! Excellent' : 'Incorrect'}
          </h3>
          <p className="text-[11px] sm:text-xs text-content-secondary font-medium leading-tight">
            {isCorrect ? 'Clinical concept validated' : 'Review clinical explanation below'}
          </p>
        </div>
      </div>

      {isCorrect && awardedXp > 0 && (
        <Badge
          variant="brand"
          size="sm"
          icon={<Zap className="w-3.5 h-3.5 text-brand-600 fill-brand-600" />}
          className="font-bold text-xs shadow-xs"
        >
          +{awardedXp} XP
        </Badge>
      )}
    </div>
  );
};
