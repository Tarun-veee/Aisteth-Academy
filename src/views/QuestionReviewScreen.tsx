import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Header } from '../components/common/Header';
import { AnswerRecord } from '../models/session.types';
import { CheckCircle2, XCircle, BookOpen, Check, HelpCircle } from 'lucide-react';

export interface QuestionReviewScreenProps {
  history: AnswerRecord[];
  onDone: () => void;
}

export const QuestionReviewScreen: React.FC<QuestionReviewScreenProps> = ({
  history,
  onDone,
}) => {
  return (
    <div className="h-full flex flex-col overflow-hidden relative w-full">
      {/* Top Header */}
      <Header
        title="Session Review"
        showBack={false}
      />

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-content-primary">
              Session Review
            </h2>
            <p className="text-xs text-content-secondary">
              Reviewing {history.length} completed questions
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDone}
            className="text-brand-600 font-bold"
          >
            Done
          </Button>
        </div>

        {/* Questions Breakdown List */}
        <div className="flex flex-col gap-3.5">
          {history.map((item, index) => {
            const status = item.evaluation.status;
            const isCorrect = status === 'CORRECT';
            const isIncorrect = status === 'INCORRECT';
            const q = item.question;

            let borderStyle = 'border-slate-200 bg-surface-white';
            if (isCorrect) borderStyle = 'border-status-successBorder bg-surface-white';
            if (isIncorrect) borderStyle = 'border-status-errorBorder bg-surface-white';

            return (
              <Card
                key={`${item.questionId}_${index}`}
                padding="md"
                className={`border-2 ${borderStyle}`}
              >
                {/* Header: Question Number & Result */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-content-primary">
                      Q{index + 1} • {q.type}
                    </span>
                    <Badge variant="brand" size="sm">
                      {q.category}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-xs">
                    {isCorrect && (
                      <span className="text-status-success flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Correct
                      </span>
                    )}
                    {isIncorrect && (
                      <span className="text-status-error flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Needs Review
                      </span>
                    )}
                    {!isCorrect && !isIncorrect && (
                      <span className="text-slate-500 flex items-center gap-1">
                        <HelpCircle className="w-4 h-4" /> Unanswered
                      </span>
                    )}
                  </div>
                </div>

                {/* Prompt */}
                <h3 className="text-sm font-bold text-content-primary leading-snug mb-2.5">
                  {q.question}
                </h3>

                {/* Solution Summary */}
                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 mb-2.5 border border-slate-200">
                  <div>
                    <span className="font-bold text-content-secondary">Correct Answer: </span>
                    <span className="font-semibold text-content-primary whitespace-pre-line">
                      {item.evaluation.correct_solution_display}
                    </span>
                  </div>
                </div>

                {/* Micro-learning Note */}
                <div className="p-3 bg-brand-50/70 rounded-xl text-xs text-brand-950 border border-brand-100/80">
                  <div className="flex items-center gap-1.5 font-bold text-brand-800 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                    <span>Clinical Takeaway:</span>
                  </div>
                  <p className="leading-relaxed">{item.evaluation.explanation}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Footer Navigation */}
        <div className="pt-2 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onClick={onDone}
            icon={<Check className="w-5 h-5 mr-1" />}
            className="font-bold min-h-[54px]"
          >
            COMPLETE & RETURN HOME
          </Button>
        </div>
      </main>
    </div>
  );
};
