import React, { useState, useEffect } from 'react';
import {
  Question,
  UserAnswerPayload,
  QUESTION_CATEGORIES
} from '../models/question.types';
import { SessionState, UserStats } from '../models/session.types';
import { AnswerEvaluator } from '../services/AnswerEvaluator';
import { QuestionRenderer } from '../components/questions/QuestionRenderer';
import { FeedbackDrawer } from '../components/feedback/FeedbackDrawer';
import { ProgressBar } from '../components/common/ProgressBar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { X, Check, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

export interface DailySessionScreenProps {
  session: SessionState;
  userStats?: UserStats;
  currentQuestion: Question | null;
  onSetAnswer: (answer: UserAnswerPayload) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  onExitSession: () => void;
  onRetry?: () => void;
  isLoading?: boolean;
}

export const DailySessionScreen: React.FC<DailySessionScreenProps> = ({
  session,
  userStats: _userStats,
  currentQuestion,
  onSetAnswer,
  onSubmitAnswer,
  onNextQuestion,
  onExitSession,
  onRetry,
  isLoading = false,
}) => {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Close exit modal on Escape key press (INT-003)
  useEffect(() => {
    if (!showExitConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowExitConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExitConfirm]);

  if (!currentQuestion) {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-brand-primary/20 border-t-brand-primary animate-spin" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-content-primary">Loading Question</h3>
            <p className="text-sm text-content-secondary">Synchronizing your daily learning session...</p>
          </div>
          <button
            type="button"
            onClick={onExitSession}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-content-secondary hover:text-content-primary py-2 px-3 rounded-lg border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-sm">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-content-primary mb-1">
          Unable to Load Question
        </h3>
        <p className="text-sm text-content-secondary max-w-sm mb-6">
          {session.submissionError || 'The question could not be loaded from the server. Please check your backend connection and retry.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          {onRetry && (
            <Button
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              onClick={onRetry}
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 border border-slate-200"
            onClick={onExitSession}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const canSubmit = AnswerEvaluator.isValidAnswer(currentQuestion, session.currentAnswer);
  const isSubmitted = session.status === 'ANSWER_SUBMITTED';
  const currentIndex = session.currentIndex;
  const totalQuestions = session.questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const categoryMeta = QUESTION_CATEGORIES[currentQuestion.category] || {
    label: currentQuestion.category,
  };

  const difficultyVariantMap: Record<string, 'brand' | 'warning' | 'error'> = {
    BEGINNER: 'brand',
    INTERMEDIATE: 'warning',
    ADVANCED: 'error',
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden relative w-full">
      {/* Session Top Bar / Header */}
      <header className="shrink-0 bg-surface-white/95 backdrop-blur-sm border-b border-slate-200/80 px-3.5 py-2.5 z-20">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          {/* Exit Button */}
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="p-1.5 -ml-1 rounded-xl text-content-secondary hover:bg-slate-100 active:bg-slate-200 transition-colors"
            aria-label="Exit Session"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Progress Bar & Counter */}
          <div className="flex-1 px-1 sm:px-2">
            <div className="flex justify-between items-center text-xs font-bold text-content-secondary mb-1">
              <span>Question {currentIndex + 1} of {totalQuestions}</span>
              <span className="text-brand-600">+{session.totalXpEarned} XP</span>
            </div>
            <ProgressBar current={currentIndex + 1} total={totalQuestions} />
          </div>
        </div>
      </header>

      {/* Main Question Body (Scrollable container for long content) */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col gap-3 max-w-md mx-auto w-full">
        {/* Category & Metadata Tags */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Badge variant="brand" size="sm">
            {categoryMeta.label}
          </Badge>
          <Badge
            variant={difficultyVariantMap[currentQuestion.difficulty] || 'brand'}
            size="sm"
          >
            {currentQuestion.difficulty}
          </Badge>
          {session.branchState === 'FOLLOW_UP' && (
            <Badge variant="warning" size="sm">
              Follow-Up Practice
            </Badge>
          )}
          {session.branchState === 'REATTEMPT_MAIN' && (
            <Badge variant="brand" size="sm">
              Primary Re-attempt
            </Badge>
          )}
          <span className="text-[11px] font-mono text-content-muted ml-auto">
            {currentQuestion.question_id || (currentQuestion as any).questionId}
          </span>
        </div>

        {/* Question Prompt */}
        <div className="pt-0.5 pb-0.5 shrink-0">
          <h2 className="text-base sm:text-lg font-bold text-content-primary leading-snug">
            {currentQuestion.question}
          </h2>
        </div>

        {/* Polymorphic Question Interaction Renderer */}
        <div className="w-full shrink-0">
          <QuestionRenderer
            question={currentQuestion}
            currentAnswer={session.currentAnswer}
            onAnswerChange={onSetAnswer}
            evaluation={session.currentEvaluation}
            isSubmitted={isSubmitted}
          />
        </div>
      </main>

      {/* Sticky Bottom Action Footer (Before submission) OR Feedback Drawer (After submission) */}
      {!isSubmitted ? (
        <footer className="shrink-0 bg-surface-white/95 backdrop-blur-md border-t border-slate-200/80 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-20">
          <div className="w-full max-w-md mx-auto">
            {session.submissionError && (
              <div className="mb-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold animate-in fade-in duration-150">
                {session.submissionError}
              </div>
            )}
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={!canSubmit || Boolean(session.isSubmitting)}
              onClick={onSubmitAnswer}
              icon={<Check className="w-5 h-5 ml-0.5" />}
              iconPosition="right"
              className="font-bold min-h-[50px] sm:min-h-[54px]"
            >
              {session.isSubmitting ? 'Evaluating...' : 'Check Answer'}
            </Button>
          </div>
        </footer>
      ) : (
        <FeedbackDrawer
          evaluation={session.currentEvaluation}
          isOpen={isSubmitted}
          onContinue={onNextQuestion}
          isLastQuestion={isLastQuestion}
          continueLabel={
            session.serverPendingTransition?.isSessionComplete || isLastQuestion
              ? 'Complete Session'
              : session.serverPendingTransition?.branchState === 'FOLLOW_UP'
              ? 'Start Follow-Up Exercise'
              : session.serverPendingTransition?.branchState === 'REATTEMPT_MAIN'
              ? 'Re-attempt Main Question'
              : undefined
          }
        />
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-modal-title"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExitConfirm(false);
          }}
        >
          <div className="w-full max-w-sm bg-surface-white rounded-3xl p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 id="exit-modal-title" className="text-lg font-bold text-content-primary mb-2">
              Leave Current Training?
            </h3>
            <p className="text-xs sm:text-sm text-content-secondary mb-5">
              Your current session progress will not be saved. Are you sure you want to return to the home screen?
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                fullWidth
                size="md"
                onClick={() => setShowExitConfirm(false)}
              >
                Continue Learning
              </Button>
              <Button
                variant="danger"
                fullWidth
                size="md"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExitSession();
                }}
              >
                Exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
