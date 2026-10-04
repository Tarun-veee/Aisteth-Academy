import React from 'react';

export interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  showLabel = false,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, total > 0 ? (current / total) * 100 : 0));

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold text-content-secondary mb-1.5">
          <span>Progress</span>
          <span>{current} of {total}</span>
        </div>
      )}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-300 ease-out shadow-sm"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
    </div>
  );
};
