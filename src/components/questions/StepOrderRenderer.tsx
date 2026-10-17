import React, { useEffect, useState } from 'react';
import { StepOrderQuestion, UserAnswerPayload, AnswerEvaluationResult } from '../../models/question.types';
import { ArrowUp, ArrowDown, Check, X } from 'lucide-react';

export interface StepOrderRendererProps {
  question: StepOrderQuestion;
  currentAnswer: UserAnswerPayload | null;
  onAnswerChange: (answer: UserAnswerPayload) => void;
  evaluation: AnswerEvaluationResult | null;
  isSubmitted: boolean;
}

export const StepOrderRenderer: React.FC<StepOrderRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  isSubmitted,
}) => {
  // Ordered step IDs
  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    if (currentAnswer && currentAnswer.type === 'STEP_ORDER') {
      return currentAnswer.ordered_step_ids;
    }
    return question.initial_steps.map((s) => s.id);
  });

  // Sync state when question changes or answer updates
  useEffect(() => {
    if (currentAnswer && currentAnswer.type === 'STEP_ORDER') {
      setOrderedIds(currentAnswer.ordered_step_ids);
    } else {
      const initial = question.initial_steps.map((s) => s.id);
      setOrderedIds(initial);
      onAnswerChange({
        type: 'STEP_ORDER',
        ordered_step_ids: initial,
      });
    }
  }, [question.question_id]);

  const stepMap = new Map(question.initial_steps.map((s) => [s.id, s.text]));

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (isSubmitted) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedIds.length) return;

    const newOrder = [...orderedIds];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    setOrderedIds(newOrder);
    onAnswerChange({
      type: 'STEP_ORDER',
      ordered_step_ids: newOrder,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <p className="text-xs font-semibold text-content-secondary px-1">
        Use arrows to arrange in chronological order (1 is first, {orderedIds.length} is last):
      </p>

      {orderedIds.map((stepId, index) => {
        const stepText = stepMap.get(stepId) || stepId;
        const isFirst = index === 0;
        const isLast = index === orderedIds.length - 1;

        const isCorrectPosition =
          isSubmitted && question.correct_step_order[index] === stepId;

        let cardStyle = 'bg-surface-white border-slate-200';
        if (isSubmitted) {
          cardStyle = isCorrectPosition
            ? 'bg-status-successBg border-status-success text-status-success'
            : 'bg-status-errorBg border-status-error text-status-error';
        }

        return (
          <div
            key={stepId}
            className={`flex items-center gap-2.5 p-3 sm:p-3.5 rounded-2xl border-2 transition-all select-none ${cardStyle}`}
          >
            {/* Step Number Badge */}
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                isSubmitted
                  ? isCorrectPosition
                    ? 'bg-status-success text-white'
                    : 'bg-status-error text-white'
                  : 'bg-brand-50 text-brand-700 border border-brand-200'
              }`}
            >
              {index + 1}
            </div>

            {/* Step Text */}
            <div className="flex-1 text-xs sm:text-sm font-medium text-content-primary leading-snug">
              {stepText}
            </div>

            {/* Reorder Arrows (Primary tactile control with >=44x44px touch targets) */}
            {!isSubmitted ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveStep(index, 'up')}
                  disabled={isFirst}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-slate-100 text-content-secondary hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all touch-manipulation select-none"
                  aria-label={`Move Step ${index + 1} Up`}
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, 'down')}
                  disabled={isLast}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-slate-100 text-content-secondary hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all touch-manipulation select-none"
                  aria-label={`Move Step ${index + 1} Down`}
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="shrink-0">
                {isCorrectPosition ? (
                  <Check className="w-5 h-5 text-status-success" />
                ) : (
                  <X className="w-5 h-5 text-status-error" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
