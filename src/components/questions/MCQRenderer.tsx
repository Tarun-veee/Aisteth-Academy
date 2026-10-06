import React from 'react';
import { MCQQuestion, UserAnswerPayload, AnswerEvaluationResult } from '../../models/question.types';
import { Check, X } from 'lucide-react';

export type OptionKey = 'option_a' | 'option_b' | 'option_c' | 'option_d';

export interface MCQRendererProps {
  question: MCQQuestion;
  currentAnswer: UserAnswerPayload | null;
  onAnswerChange: (answer: UserAnswerPayload) => void;
  evaluation: AnswerEvaluationResult | null;
  isSubmitted: boolean;
  eliminatedOptions?: OptionKey[];
}

export const MCQRenderer: React.FC<MCQRendererProps> = ({
  question,
  currentAnswer,
  onAnswerChange,
  evaluation,
  isSubmitted,
  eliminatedOptions = [],
}) => {
  const selectedOption =
    currentAnswer && currentAnswer.type === 'MCQ' ? currentAnswer.selected_option : null;

  const options: { key: OptionKey; label: string; text: string }[] = [
    { key: 'option_a', label: 'A', text: question.option_a },
    { key: 'option_b', label: 'B', text: question.option_b },
    { key: 'option_c', label: 'C', text: question.option_c },
    { key: 'option_d', label: 'D', text: question.option_d },
  ];

  const handleSelect = (key: OptionKey) => {
    if (isSubmitted || eliminatedOptions.includes(key)) return;
    onAnswerChange({
      type: 'MCQ',
      selected_option: key,
    });
  };

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
      {options.map(({ key, label, text }) => {
        const isEliminated = eliminatedOptions.includes(key);
        const isSelected = selectedOption === key;
        const isCorrectSolution = isSubmitted && question.correct_answer === key;
        const isUserIncorrectSelection = isSubmitted && isSelected && !evaluation?.is_correct;

        let cardStyle = 'bg-surface-white border-slate-200 hover:border-slate-300';
        let badgeStyle = 'bg-slate-100 text-content-primary border-slate-200';
        let icon = null;

        if (isSubmitted) {
          if (isCorrectSolution) {
            cardStyle = 'bg-status-successBg border-status-success text-status-success shadow-xs';
            badgeStyle = 'bg-status-success text-white border-transparent';
            icon = <Check className="w-5 h-5 text-status-success shrink-0" />;
          } else if (isUserIncorrectSelection) {
            cardStyle = 'bg-status-errorBg border-status-error text-status-error';
            badgeStyle = 'bg-status-error text-white border-transparent';
            icon = <X className="w-5 h-5 text-status-error shrink-0" />;
          } else {
            cardStyle = 'bg-slate-50 border-slate-200 opacity-50';
          }
        } else if (isEliminated) {
          cardStyle = 'bg-slate-100/50 border-dashed border-slate-200/80 text-slate-400 opacity-45 cursor-not-allowed';
          badgeStyle = 'bg-slate-200/80 text-slate-400 border-slate-200 line-through';
        } else if (isSelected) {
          cardStyle = 'bg-brand-50/70 border-brand-600 shadow-soft ring-1 ring-brand-600';
          badgeStyle = 'bg-brand-600 text-white border-transparent';
        }

        return (
          <button
            key={key}
            type="button"
            onClick={() => handleSelect(key)}
            disabled={isSubmitted || isEliminated}
            className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all duration-150 min-h-[52px] sm:min-h-[58px] select-none ${
              !isSubmitted && !isEliminated
                ? 'cursor-pointer active:scale-[0.99]'
                : 'cursor-default'
            } ${cardStyle}`}
            aria-pressed={isSelected}
            aria-disabled={isEliminated}
            aria-label={
              isEliminated
                ? `Option ${label}: ${text} (Eliminated by 50/50)`
                : `Option ${label}: ${text}`
            }
          >
            {/* Option Badge (A, B, C, D) */}
            <span
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${badgeStyle}`}
            >
              {label}
            </span>

            {/* Option Text */}
            <span
              className={`flex-1 text-sm sm:text-base font-medium leading-snug ${
                isEliminated ? 'text-slate-400 line-through decoration-slate-300' : 'text-content-primary'
              }`}
            >
              {text}
            </span>

            {/* 50/50 Eliminated Tag */}
            {isEliminated && !isSubmitted && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-200/70 px-2 py-0.5 rounded-md shrink-0">
                Eliminated
              </span>
            )}

            {/* Post-submission Result Icon */}
            {icon}
          </button>
        );
      })}
    </div>
  );
};
