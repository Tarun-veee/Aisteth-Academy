import React, { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Header } from '../components/common/Header';
import { AnswerRecord, ReviewStatus } from '../models/session.types';
import { useUnsolvedQuestions } from '../hooks/useUnsolvedQuestions';
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  Check,
  HelpCircle,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Save,
  ArrowLeft
} from 'lucide-react';

function formatCorrectAnswerDisplay(q: any): string {
  if (!q) return 'Refer to clinical explanation';
  switch (q.type) {
    case 'MCQ': {
      const optKey = q.correct_answer || '';
      const optText = q[optKey] || optKey;
      return `${optKey.replace('option_', '').toUpperCase()}. ${optText}`;
    }
    case 'TRUE_FALSE':
      return q.correct_answer ? 'True' : 'False';
    case 'IMAGE_TAP':
      return q.target_zone?.label || 'Target anatomical landmark';
    case 'STEP_ORDER':
      return Array.isArray(q.steps)
        ? q.steps.map((s: any, i: number) => `${i + 1}. ${s.text}`).join('\n')
        : 'Correct clinical order';
    case 'AUDIO_DISCRIMINATION':
      return q.correct_audio === 'audio_a' ? 'Recording A' : 'Recording B';
    default:
      return q.correct_answer || 'Refer to clinical explanation';
  }
}

export interface QuestionReviewScreenProps {
  history?: AnswerRecord[];
  onDone: () => void;
  mode?: 'SESSION_SUMMARY' | 'UNSOLVED_VAULT';
  onNavigateHome?: () => void;
}

const STATUS_FILTERS: Array<{ label: string; value: 'ALL' | ReviewStatus }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Unreviewed', value: 'UNREVIEWED' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Reviewed', value: 'REVIEWED' },
  { label: 'Bookmarked', value: 'BOOKMARKED' },
];

export const QuestionReviewScreen: React.FC<QuestionReviewScreenProps> = ({
  history = [],
  onDone,
  mode = 'SESSION_SUMMARY',
  onNavigateHome,
}) => {
  // If in UNSOLVED_VAULT mode, bind to the useUnsolvedQuestions hook
  const {
    items,
    filteredItems,
    isLoading,
    isError,
    errorMessage,
    activeFilter,
    setActiveFilter,
    refetch,
    updateReview,
  } = useUnsolvedQuestions();

  const [expandedFollowUps, setExpandedFollowUps] = useState<Record<string, boolean>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [activeNoteBox, setActiveNoteBox] = useState<Record<string, boolean>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const toggleFollowUp = (id: string) => {
    setExpandedFollowUps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStatusChange = async (id: string, newStatus: ReviewStatus) => {
    try {
      await updateReview(id, { reviewStatus: newStatus });
    } catch {
      // Error handled and rolled back in hook
    }
  };

  const handleSaveNotes = async (id: string) => {
    const note = editingNotes[id];
    setSavingNoteId(id);
    try {
      await updateReview(id, { reviewNotes: note });
      setActiveNoteBox((prev) => ({ ...prev, [id]: false }));
    } catch {
      // Error handled in hook
    } finally {
      setSavingNoteId(null);
    }
  };

  // =========================================================================
  // 1. SESSION SUMMARY MODE (Daily 10-Question Post-Session History)
  // =========================================================================
  if (mode === 'SESSION_SUMMARY') {
    return (
      <div className="h-full flex flex-col overflow-hidden relative w-full">
        <Header title="Session Review" showBack={false} />

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-content-primary">Session Review</h2>
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
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-content-primary shrink-0">
                        Q{index + 1} • {q.type}
                      </span>
                      <Badge variant="brand" size="sm" className="max-w-full">
                        {q.category}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 font-bold text-xs shrink-0 ml-auto">
                      {isCorrect && (
                        <span className="text-status-success flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 shrink-0" /> Correct
                        </span>
                      )}
                      {isIncorrect && (
                        <span className="text-status-error flex items-center gap-1">
                          <XCircle className="w-4 h-4 shrink-0" /> Needs Review
                        </span>
                      )}
                      {!isCorrect && !isIncorrect && (
                        <span className="text-slate-500 flex items-center gap-1">
                          <HelpCircle className="w-4 h-4 shrink-0" /> Unanswered
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-content-primary leading-snug mb-2.5">
                    {q.question}
                  </h3>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 mb-2.5 border border-slate-200">
                    <div>
                      <span className="font-bold text-content-secondary">Correct Answer: </span>
                      <span className="font-semibold text-content-primary whitespace-pre-line">
                        {item.evaluation.correct_solution_display}
                      </span>
                    </div>
                  </div>

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
  }

  // =========================================================================
  // 2. UNSOLVED VAULT MODE (On-Demand Clinical Reinforcement Vault)
  // =========================================================================
  return (
    <div className="h-full flex flex-col overflow-hidden relative w-full bg-surface-bg">
      <Header
        title="Clinical Vault"
        showBack={true}
        onBack={onNavigateHome || onDone}
      />

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col gap-4 max-w-md mx-auto w-full pb-8">
        {/* Vault Overview Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider">
                Targeted Remediation
              </span>
              <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-brand-100 text-brand-800">
                {items.length} Saved
              </span>
            </div>
            <h2 className="text-xl font-black text-content-primary tracking-tight mt-0.5">
              Unsolved Questions
            </h2>
            <p className="text-xs text-content-secondary mt-0.5">
              Reinforce clinical concepts and paired follow-ups from your sessions.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateHome || onDone}
            icon={<ArrowLeft className="w-4 h-4 mr-1" />}
            className="text-content-secondary font-bold shrink-0"
          >
            Back
          </Button>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          {STATUS_FILTERS.map((f) => {
            const isSelected = activeFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setActiveFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-surface-white text-content-secondary border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Loading State Skeleton */}
        {isLoading && (
          <div className="flex flex-col gap-3.5 animate-pulse">
            {[1, 2].map((n) => (
              <div key={n} className="p-4 rounded-3xl bg-surface-white border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-5 w-24 bg-slate-200 rounded-lg" />
                  <div className="h-5 w-16 bg-slate-200 rounded-lg" />
                </div>
                <div className="h-10 w-full bg-slate-100 rounded-xl" />
                <div className="h-16 w-full bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry Button */}
        {isError && !isLoading && (
          <Card padding="md" className="border-2 border-rose-200 bg-rose-50 text-rose-950 flex flex-col items-center text-center p-6 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-900">Failed to Load Unsolved Questions</h3>
              <p className="text-xs text-rose-800/90 mt-1 max-w-xs">{errorMessage || 'Connection timeout or server error.'}</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={refetch}
              icon={<RefreshCw className="w-4 h-4 mr-1.5" />}
              className="font-bold min-h-[44px] px-5"
            >
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty State (Celebratory Zero Unsolved Banner) */}
        {!isLoading && !isError && items.length === 0 && (
          <Card padding="lg" className="border-2 border-emerald-200 bg-emerald-50/70 text-center flex flex-col items-center p-6 sm:p-8 gap-3.5 shadow-soft">
            <div className="w-14 h-14 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-emerald-950">
                Clinical Vault Clear! 🎉
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800/90 mt-1 max-w-xs leading-relaxed">
                You have resolved all clinical questions from your daily practice sessions. Outstanding diligence!
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={onNavigateHome || onDone}
              className="font-bold min-h-[46px] px-6 mt-1"
            >
              Return to Dashboard
            </Button>
          </Card>
        )}

        {/* Filtered Empty State */}
        {!isLoading && !isError && items.length > 0 && filteredItems.length === 0 && (
          <div className="p-6 text-center bg-surface-white rounded-2xl border border-slate-200">
            <p className="text-xs font-semibold text-content-secondary">
              No questions found with status "{activeFilter}".
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter('ALL')}
              className="text-brand-600 font-bold mt-2"
            >
              Show All ({items.length})
            </Button>
          </div>
        )}

        {/* Unsolved Question Cards List */}
        {!isLoading && !isError && filteredItems.length > 0 && (
          <div className="flex flex-col gap-4">
            {filteredItems.map(({ record, mainQuestion, followUpQuestion }) => {
              const isFollowUpExpanded = Boolean(expandedFollowUps[record.id]);
              const isNoteBoxOpen = Boolean(activeNoteBox[record.id]);
              const currentNote = editingNotes[record.id] ?? record.reviewNotes ?? '';
              const isSavingThisNote = savingNoteId === record.id;

              const isFollowUpFailed = record.initialReason === 'FOLLOW_UP_FAILED';
              const reasonLabel = isFollowUpFailed
                ? 'Follow-Up Practice Failed'
                : 'Primary Re-attempt Failed';

              return (
                <Card
                  key={record.id}
                  padding="md"
                  className="border-2 border-slate-200/90 shadow-card bg-surface-white flex flex-col gap-3"
                >
                  {/* Card Header: IDs, Failure Reason Badge & Fail Count */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-content-primary">
                        {record.id}
                      </span>
                      <Badge variant="brand" size="sm">
                        {mainQuestion.category}
                      </Badge>
                      <Badge
                        variant={isFollowUpFailed ? 'warning' : 'error'}
                        size="sm"
                      >
                        {reasonLabel}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg ml-auto">
                      <Clock className="w-3 h-3 text-rose-600" />
                      <span>Failed {record.failCount}x</span>
                    </div>
                  </div>

                  {/* Primary Question Prompt */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-content-secondary block mb-0.5">
                      Primary Question
                    </span>
                    <h3 className="text-sm font-bold text-content-primary leading-snug">
                      {mainQuestion.question}
                    </h3>
                  </div>

                  {/* Correct Solution & Clinical Takeaway */}
                  <div className="p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 text-xs flex flex-col gap-2">
                    <div>
                      <span className="font-bold text-content-secondary">Correct Answer: </span>
                      <span className="font-semibold text-content-primary whitespace-pre-line">
                        {formatCorrectAnswerDisplay(mainQuestion)}
                      </span>
                    </div>
                    {mainQuestion.explanation && (
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <span className="font-bold text-brand-800 block mb-0.5">
                          Clinical Explanation:
                        </span>
                        <p className="text-content-secondary leading-relaxed">
                          {mainQuestion.explanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Canonical Follow-Up Practice Question Accordion */}
                  {followUpQuestion && (
                    <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleFollowUp(record.id)}
                        className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-amber-950 hover:bg-amber-100/50 transition-colors cursor-pointer"
                        aria-expanded={isFollowUpExpanded}
                      >
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                          <span>Linked Follow-Up Exercise ({followUpQuestion.question_id})</span>
                        </span>
                        {isFollowUpExpanded ? (
                          <ChevronUp className="w-4 h-4 text-amber-800" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-amber-800" />
                        )}
                      </button>

                      {isFollowUpExpanded && (
                        <div className="p-3 pt-0 border-t border-amber-200/60 text-xs flex flex-col gap-2 animate-in fade-in duration-150">
                          <p className="font-semibold text-amber-950 leading-snug mt-2">
                            {followUpQuestion.question}
                          </p>
                          <div className="p-2 bg-white/80 rounded-xl border border-amber-200/60">
                            <span className="font-bold text-amber-900">Follow-Up Answer: </span>
                            <span className="font-semibold text-content-primary whitespace-pre-line">
                              {formatCorrectAnswerDisplay(followUpQuestion)}
                            </span>
                          </div>
                          {followUpQuestion.learning_objective && (
                            <p className="text-[11px] text-amber-900/80 italic">
                              Objective: {followUpQuestion.learning_objective}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clinical Review Status Selector */}
                  <div className="pt-1 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                        Review Status:
                      </span>
                      {record.reviewedAt && (
                        <span className="text-[10px] text-content-muted">
                          Last reviewed: {new Date(record.reviewedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(['UNREVIEWED', 'IN_REVIEW', 'REVIEWED', 'BOOKMARKED'] as ReviewStatus[]).map((st) => {
                        const isCurrent = record.reviewStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(record.id, st)}
                            className={`py-1.5 px-1 rounded-xl text-[10px] font-bold text-center transition-all cursor-pointer ${
                              isCurrent
                                ? st === 'REVIEWED'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : st === 'BOOKMARKED'
                                  ? 'bg-amber-500 text-white shadow-2xs'
                                  : st === 'IN_REVIEW'
                                  ? 'bg-brand-600 text-white shadow-2xs'
                                  : 'bg-slate-700 text-white shadow-2xs'
                                : 'bg-slate-100 text-content-secondary hover:bg-slate-200'
                            }`}
                          >
                            {st === 'UNREVIEWED' && 'Unreviewed'}
                            {st === 'IN_REVIEW' && 'In Review'}
                            {st === 'REVIEWED' && 'Reviewed'}
                            {st === 'BOOKMARKED' && 'Bookmark'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clinical Review Notes Section */}
                  <div className="pt-1">
                    {!isNoteBoxOpen && !record.reviewNotes && (
                      <button
                        type="button"
                        onClick={() => setActiveNoteBox((prev) => ({ ...prev, [record.id]: true }))}
                        className="text-[11px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Add Clinical Reinforcement Note</span>
                      </button>
                    )}

                    {(isNoteBoxOpen || record.reviewNotes) && (
                      <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-content-secondary text-[11px] flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-brand-600" />
                            <span>Clinical Notes</span>
                          </span>
                          {!isNoteBoxOpen && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNotes((prev) => ({ ...prev, [record.id]: record.reviewNotes || '' }));
                                setActiveNoteBox((prev) => ({ ...prev, [record.id]: true }));
                              }}
                              className="text-[10px] font-bold text-brand-600 hover:underline cursor-pointer"
                            >
                              Edit Note
                            </button>
                          )}
                        </div>

                        {isNoteBoxOpen ? (
                          <>
                            <textarea
                              rows={2}
                              value={currentNote}
                              maxLength={1000}
                              onChange={(e) =>
                                setEditingNotes((prev) => ({ ...prev, [record.id]: e.target.value }))
                              }
                              placeholder="Write clinical takeaway or mnemonic..."
                              className="w-full text-xs p-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-brand-500 bg-white"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveNoteBox((prev) => ({ ...prev, [record.id]: false }))}
                                className="text-[11px] py-1 h-auto"
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={isSavingThisNote}
                                onClick={() => handleSaveNotes(record.id)}
                                icon={<Save className="w-3.5 h-3.5 mr-1" />}
                                className="text-[11px] py-1 h-auto font-bold"
                              >
                                {isSavingThisNote ? 'Saving...' : 'Save Note'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-content-primary italic leading-relaxed text-xs">
                            "{record.reviewNotes}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
