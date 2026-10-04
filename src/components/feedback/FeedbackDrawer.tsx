import React, { useEffect } from 'react';
import { AnswerEvaluationResult } from '../../models/question.types';
import { ResultBanner } from './ResultBanner';
import { MicroLearningSheet } from './MicroLearningSheet';
import { Button } from '../common/Button';
import { ArrowRight, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { useBottomSheetGesture } from '../../hooks/useBottomSheetGesture';

export interface FeedbackDrawerProps {
  evaluation: AnswerEvaluationResult | null;
  isOpen: boolean;
  onContinue: () => void;
  isLastQuestion?: boolean;
  canRetry?: boolean;
  onUseRetry?: () => void;
}

export const FeedbackDrawer: React.FC<FeedbackDrawerProps> = ({
  evaluation,
  isOpen,
  onContinue,
  isLastQuestion = false,
  canRetry = false,
  onUseRetry,
}) => {
  const {
    sheetState,
    setSheetState,
    toggleSheetState,
    isDragging,
    dragOffsetY,
    handleProps,
    contentProps,
    containerProps,
  } = useBottomSheetGesture({
    initialState: 'COLLAPSED',
    thresholdPx: 45,
    velocityThreshold: 0.4,
  });

  // Reset to collapsed state whenever a new evaluation or question arrives
  useEffect(() => {
    if (isOpen) {
      setSheetState('COLLAPSED');
    }
  }, [isOpen, evaluation?.question_id, setSheetState]);

  if (!isOpen || !evaluation) return null;

  const isCorrect = evaluation.is_correct;
  const isExpanded = sheetState === 'EXPANDED';

  // Dynamic height styling
  const heightClasses = isExpanded
    ? 'max-h-[86dvh] sm:max-h-[88dvh]'
    : 'max-h-[48dvh] sm:max-h-[50dvh]';

  return (
    <footer
      {...containerProps}
      className={`shrink-0 w-full max-w-md mx-auto rounded-t-3xl border-t-2 flex flex-col shadow-float z-30 touch-manipulation select-none ${
        !isDragging ? 'transition-[max-height,height,transform] duration-300 ease-out' : ''
      } ${heightClasses} ${
        isCorrect
          ? 'bg-status-successBg border-status-successBorder text-emerald-950'
          : 'bg-status-errorBg border-status-errorBorder text-rose-950'
      }`}
      style={
        isDragging && dragOffsetY !== 0
          ? {
              transform: `translateY(${dragOffsetY * 0.35}px)`,
            }
          : undefined
      }
    >
      {/* Centered Native Drag Handle Zone */}
      <div
        {...handleProps}
        role="button"
        tabIndex={0}
        aria-label={isExpanded ? 'Collapse explanation panel' : 'Expand full clinical explanation'}
        aria-expanded={isExpanded}
        onClick={toggleSheetState}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSheetState();
          }
        }}
        className="w-full flex flex-col items-center justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none select-none group focus-visible:outline-hidden"
      >
        {/* Visual Pill Indicator */}
        <div
          className={`w-12 h-1.5 rounded-full transition-all duration-150 ${
            isCorrect
              ? 'bg-emerald-600/35 group-hover:bg-emerald-600/60 group-active:scale-x-110'
              : 'bg-rose-600/35 group-hover:bg-rose-600/60 group-active:scale-x-110'
          }`}
        />
        {/* Subtle expansion hint text */}
        <div className="flex items-center gap-1 text-[10px] font-bold opacity-60 mt-0.5">
          {isExpanded ? (
            <>
              <span>Swipe down to collapse</span>
              <ChevronDown className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>Swipe up for full breakdown</span>
              <ChevronUp className="w-3 h-3" />
            </>
          )}
        </div>
      </div>

      {/* Top Status Banner (shrink-0) */}
      <div className="px-4 pt-1 pb-1.5 shrink-0">
        <ResultBanner isCorrect={isCorrect} awardedXp={evaluation.awarded_xp} />
      </div>

      {/* Micro-learning Body (Scrollable if text exceeds available height) */}
      <div
        ref={contentProps.ref}
        onPointerDown={contentProps.onPointerDown}
        onScroll={contentProps.onScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-1 pr-3"
      >
        <MicroLearningSheet evaluation={evaluation} />
      </div>

      {/* Action Buttons: Continue OR Retry (shrink-0 + safe area padding) */}
      <div className="p-3 sm:p-4 pt-2 border-t border-black/5 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-inherit flex gap-2.5">
        {!isCorrect && canRetry && onUseRetry && (
          <Button
            variant="outline"
            fullWidth
            size="lg"
            onClick={onUseRetry}
            icon={<RotateCcw className="w-5 h-5 mr-1" />}
            className="font-bold min-h-[48px] sm:min-h-[52px] border-rose-300 hover:bg-rose-100/50 active:bg-rose-100 text-rose-950"
            aria-label="Use RETRY Power-Up to re-attempt this question"
          >
            Use RETRY
          </Button>
        )}
        <Button
          variant={isCorrect ? 'success' : 'primary'}
          fullWidth
          size="lg"
          onClick={onContinue}
          icon={<ArrowRight className="w-5 h-5 ml-1" />}
          iconPosition="right"
          className="font-bold min-h-[48px] sm:min-h-[52px]"
        >
          {isLastQuestion ? 'Complete Session' : 'Continue'}
        </Button>
      </div>
    </footer>
  );
};
