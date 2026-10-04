import React from 'react';
import { TrueFalseQuestion, UserAnswerPayload, AnswerEvaluationResult } from '../../models/question.types';
import { CheckCircle2, XCircle, Check, X } from 'lucide-react';

export interface TrueFalseRendererProps {
  question: TrueFalseQuestion;
  currentAnswer: UserAnswerPayload | null;
  onAnswerChange: (answer: UserAnswerPayload) => void;
  evaluation: AnswerEvaluationResult | null;
  isSubmitted: boolean;
}

export const TrueFalseRenderer: React.FC<TrueFalseRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  evaluation,
  isSubmitted,
}) => {
  const selectedBool =
    currentAnswer && currentAnswer.type === 'TRUE_FALSE'
      ? currentAnswer.selected_boolean
      : null;

  const handleSelect = (val: boolean) => {
    if (isSubmitted) return;
    onAnswerChange({
      type: 'TRUE_FALSE',
      selected_boolean: val,
    });
  };

  const options: { val: boolean; label: string; icon: React.ReactNode }[] = [
    {
      val: true,
      label: 'TRUE',
      icon: <CheckCircle2 className="w-6 h-6 text-brand-600" />,
    },
    {
      val: false,
      label: 'FALSE',
      icon: <XCircle className="w-6 h-6 text-content-secondary" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {options.map(({ val, label, icon }) => {
        const isSelected = selectedBool === val;
        const isCorrectSolution = isSubmitted && question.correct_answer === val;
        const isUserIncorrectSelection = isSubmitted && isSelected && !evaluation?.is_correct;

        let cardStyle = 'bg-surface-white border-slate-200 hover:border-slate-300';
        let statusIcon = null;

        if (isSubmitted) {
          if (isCorrectSolution) {
            cardStyle = 'bg-status-successBg border-status-success text-status-success shadow-sm';
            statusIcon = <Check className="w-6 h-6 text-status-success shrink-0" />;
          } else if (isUserIncorrectSelection) {
            cardStyle = 'bg-status-errorBg border-status-error text-status-error';
            statusIcon = <X className="w-6 h-6 text-status-error shrink-0" />;
          } else {
            cardStyle = 'bg-slate-50 border-slate-200 opacity-60';
          }
        } else if (isSelected) {
          cardStyle = 'bg-brand-50/70 border-brand-600 shadow-soft ring-1 ring-brand-600';
        }

        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => handleSelect(val)}
            disabled={isSubmitted}
            className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-150 min-h-[60px] sm:min-h-[72px] select-none ${
              !isSubmitted ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
            } ${cardStyle}`}
            aria-pressed={isSelected}
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0">{icon}</span>
              <span className="text-base sm:text-lg font-bold tracking-wide">
                {label}
              </span>
            </div>

            {statusIcon || (
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
