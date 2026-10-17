import React from 'react';
import { AnswerEvaluationResult } from '../../models/question.types';
import { BookOpen, GraduationCap } from 'lucide-react';

export interface MicroLearningSheetProps {
  evaluation: AnswerEvaluationResult;
}

export const MicroLearningSheet: React.FC<MicroLearningSheetProps> = ({ evaluation }) => {
  return (
    <div className="flex flex-col gap-2 w-full my-1">
      {/* Micro-Learning Clinical Explanation */}
      <div className="p-2.5 sm:p-3 bg-brand-50/80 rounded-2xl border border-brand-100/80">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-brand-800 mb-0.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
          <span>MICRO-LEARNING POINT:</span>
        </div>
        <p className="text-xs sm:text-sm text-content-primary leading-relaxed">
          {evaluation.explanation}
        </p>
      </div>

      {/* Learning Objective */}
      {evaluation.learning_objective && (
        <div className="px-3 py-1.5 bg-white/90 rounded-xl border border-slate-200/80 flex items-start gap-2">
          <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-content-secondary leading-normal">
            <span className="font-semibold text-content-primary">Objective: </span>
            {evaluation.learning_objective}
          </div>
        </div>
      )}
    </div>
  );
};
