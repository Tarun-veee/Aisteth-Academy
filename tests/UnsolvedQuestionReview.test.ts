import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { useUnsolvedQuestions } from '../src/hooks/useUnsolvedQuestions';
import { questionApi } from '../src/api/questionApi';
import { sessionApi } from '../src/api/sessionApi';
import { Question } from '../models/question.types';
import { UnsolvedQuestionItem } from '../src/models/session.types';

// Mock questionApi
vi.mock('../src/api/questionApi', () => ({
  questionApi: {
    getTodayQuestions: vi.fn(),
    getQuestionById: vi.fn(),
    getUnsolvedQuestions: vi.fn(),
    updateUnsolvedQuestion: vi.fn(),
  },
}));

// Mock sessionApi to verify zero-call isolation
vi.mock('../src/api/sessionApi', () => ({
  sessionApi: {
    getTodaySession: vi.fn(),
    recordAttempt: vi.fn(),
    finalizeSession: vi.fn(),
  },
}));

/**
 * Pure Node.js React hook harness using React internals dispatcher.
 * Allows testing stateful hooks (useState, useCallback, useEffect, useMemo) in pure Node.
 */
function createHookHarness<T>(hookFn: () => T) {
  const states: any[] = [];
  const refs: any[] = [];
  const callbacks: Array<{ fn: any; deps: any[] | undefined }> = [];
  const effects: Array<{ effect: any; deps: any[] | undefined }> = [];
  let stateIdx = 0;
  let refIdx = 0;
  let cbIdx = 0;
  let effIdx = 0;
  const effectQueue: Array<() => void> = [];
  let currentResult: T;
  let isRerendering = false;

  const dispatcher = {
    useState(initial: any) {
      const idx = stateIdx++;
      if (states.length <= idx) {
        states.push(typeof initial === 'function' ? initial() : initial);
      }
      const setState = (action: any) => {
        const nextVal = typeof action === 'function' ? action(states[idx]) : action;
        if (!Object.is(states[idx], nextVal)) {
          states[idx] = nextVal;
          if (!isRerendering) {
            rerender();
          }
        }
      };
      return [states[idx], setState];
    },
    useRef(initial: any) {
      const idx = refIdx++;
      if (refs.length <= idx) {
        refs.push({ current: initial });
      }
      return refs[idx];
    },
    useCallback(fn: any, deps?: any[]) {
      const idx = cbIdx++;
      const prev = callbacks[idx];
      if (prev && deps && prev.deps) {
        const unchanged = deps.length === prev.deps.length && deps.every((d, i) => Object.is(d, prev.deps![i]));
        if (unchanged) {
          return prev.fn;
        }
      }
      callbacks[idx] = { fn, deps };
      return fn;
    },
    useEffect(effect: any, deps?: any[]) {
      const idx = effIdx++;
      const prev = effects[idx];
      let hasChanged = true;
      if (prev && deps && prev.deps) {
        hasChanged = deps.length !== prev.deps.length || deps.some((d, i) => !Object.is(d, prev.deps![i]));
      }
      if (hasChanged) {
        effects[idx] = { effect, deps };
        effectQueue.push(effect);
      }
    },
    useMemo(fn: any, deps?: any[]) {
      return fn();
    },
  };

  function rerender() {
    if (isRerendering) return;
    isRerendering = true;
    stateIdx = 0;
    refIdx = 0;
    cbIdx = 0;
    effIdx = 0;
    (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher.current = dispatcher;
    currentResult = hookFn();
    isRerendering = false;

    while (effectQueue.length > 0) {
      const eff = effectQueue.shift();
      if (eff) eff();
    }
  }

  rerender();

  return {
    get: () => currentResult,
    rerender,
  };
}

describe('Stage 5 — Frontend Unsolved Question Review Suite', () => {
  const mockPrimaryQuestion: Question = {
    question_id: 'MG-AIA-01-TH',
    type: 'MCQ',
    category: 'HEART_RECORDING',
    difficulty: 'BEGINNER',
    question: 'Where is the aortic auscultation landmark located?',
    option_a: 'Second right intercostal space at sternal border',
    option_b: 'Second left intercostal space',
    option_c: 'Fifth left intercostal space midclavicular line',
    option_d: 'Fourth left intercostal space sternal border',
    correct_answer: 'option_a',
    explanation: 'The aortic area is located at the 2nd right intercostal space along the right sternal border.',
    learning_objective: 'Identify anatomical location for aortic valve auscultation.',
    tags: ['auscultation', 'aortic'],
    clinician_validated: true,
    source: 'MEDGEMMA',
    version: '1.0.0',
    question_type: 'Primary',
    follow_up_for: null,
  };

  const mockFollowUpQuestion: Question = {
    question_id: 'MG-AIA-01-PR',
    type: 'MCQ',
    category: 'HEART_RECORDING',
    difficulty: 'BEGINNER',
    question: 'Aortic auscultation practice: Which rib border is used?',
    option_a: 'Left sternal border',
    option_b: 'Right sternal border',
    option_c: 'Midaxillary line',
    option_d: 'Xiphoid process',
    correct_answer: 'option_b',
    explanation: 'Aortic sounds radiate along the right sternal border.',
    learning_objective: 'Reinforce aortic valve sound radiation landmarks.',
    tags: ['auscultation', 'practice'],
    clinician_validated: true,
    source: 'MEDGEMMA',
    version: '1.0.0',
    question_type: 'Follow-Up',
    follow_up_for: 'MG-AIA-01-TH',
  };

  const mockUnsolvedItem: UnsolvedQuestionItem = {
    record: {
      id: 'MG-AIA-01-TH',
      mainQuestionId: 'MG-AIA-01-TH',
      followUpQuestionId: 'MG-AIA-01-PR',
      topic: 'Heart Sound Auscultation',
      difficultyRank: 1,
      failCount: 2,
      initialReason: 'FOLLOW_UP_FAILED',
      lastFailedReason: 'REATTEMPT_FAILED',
      firstFailedSessionId: 'daily_2026-10-10_usr_stag',
      lastFailedSessionId: 'daily_2026-10-11_usr_stag',
      isResolved: false,
      reviewStatus: 'UNREVIEWED',
      reviewedAt: null,
      reviewNotes: undefined,
      createdAt: '2026-10-10T10:00:00.000Z',
      updatedAt: '2026-10-11T10:00:00.000Z',
      firstFailedAt: '2026-10-10T10:00:00.000Z',
      lastFailedAt: '2026-10-11T10:00:00.000Z',
    },
    mainQuestion: mockPrimaryQuestion,
    followUpQuestion: mockFollowUpQuestion,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [mockUnsolvedItem],
      totalCount: 1,
    });
  });

  // =========================================================================
  // 1. LOADING STATE
  // =========================================================================
  it('Scenario 1: Initializes in loading state before API responds', () => {
    let resolvePromise: any;
    const pendingPromise = new Promise<any>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(questionApi.getUnsolvedQuestions).mockReturnValue(pendingPromise);

    const harness = createHookHarness(() => useUnsolvedQuestions());
    expect(harness.get().isLoading).toBe(true);
    expect(harness.get().items).toEqual([]);

    resolvePromise({ success: true, unsolvedQuestions: [mockUnsolvedItem], totalCount: 1 });
  });

  // =========================================================================
  // 2. EMPTY STATE
  // =========================================================================
  it('Scenario 2: Correctly represents empty state when user has 0 unsolved questions', async () => {
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [],
      totalCount: 0,
    });

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    expect(harness.get().isLoading).toBe(false);
    expect(harness.get().isError).toBe(false);
    expect(harness.get().items).toHaveLength(0);
    expect(harness.get().filteredItems).toHaveLength(0);
  });

  // =========================================================================
  // 3. ERROR AND RETRY STATE
  // =========================================================================
  it('Scenario 3: Captures error state on network failure and successfully recovers on retry', async () => {
    vi.mocked(questionApi.getUnsolvedQuestions).mockRejectedValue(
      new Error('Failed to fetch: Connection timeout')
    );

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    expect(harness.get().isLoading).toBe(false);
    expect(harness.get().isError).toBe(true);
    expect(harness.get().errorMessage).toContain('Connection timeout');

    // User taps "Try Again"
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [mockUnsolvedItem],
      totalCount: 1,
    });

    await harness.get().refetch();

    expect(harness.get().isLoading).toBe(false);
    expect(harness.get().isError).toBe(false);
    expect(harness.get().errorMessage).toBeNull();
    expect(harness.get().items).toHaveLength(1);
  });

  // =========================================================================
  // 4. PAIRED QUESTION RENDERING CONTRACT
  // =========================================================================
  it('Scenario 4: Validates that each item contains paired Primary and Follow-Up questions with remedial reason', async () => {
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [mockUnsolvedItem],
      totalCount: 1,
    });

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    const loaded = harness.get().items[0];
    expect(loaded).toBeDefined();

    // Primary question checks
    expect(loaded.mainQuestion.question_id).toBe('MG-AIA-01-TH');
    expect(loaded.mainQuestion.question).toBe('Where is the aortic auscultation landmark located?');
    expect(loaded.mainQuestion.correct_answer).toBe('option_a');

    // Canonical Follow-Up checks
    expect(loaded.followUpQuestion).toBeDefined();
    expect(loaded.followUpQuestion?.question_id).toBe('MG-AIA-01-PR');
    expect(loaded.followUpQuestion?.follow_up_for).toBe('MG-AIA-01-TH');

    // Remedial reason and failure count
    expect(loaded.record.failCount).toBe(2);
    expect(loaded.record.initialReason).toBe('FOLLOW_UP_FAILED');
    expect(loaded.record.lastFailedReason).toBe('REATTEMPT_FAILED');
  });

  // =========================================================================
  // 5. REVIEW STATUS AND NOTES UPDATE
  // =========================================================================
  it('Scenario 5: Dispatches updateReview, performs optimistic update, and synchronizes with server response', async () => {
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [mockUnsolvedItem],
      totalCount: 1,
    });

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    expect(harness.get().items[0].record.reviewStatus).toBe('UNREVIEWED');

    // Mock successful backend update
    vi.mocked(questionApi.updateUnsolvedQuestion).mockResolvedValue({
      success: true,
      updatedRecord: {
        ...mockUnsolvedItem.record,
        reviewStatus: 'REVIEWED',
        reviewNotes: 'Verified diaphragm placement with mentor.',
        reviewedAt: '2026-10-12T12:00:00.000Z',
        updatedAt: '2026-10-12T12:00:00.000Z',
      },
    });

    await harness.get().updateReview('MG-AIA-01-TH', {
      reviewStatus: 'REVIEWED',
      reviewNotes: 'Verified diaphragm placement with mentor.',
    });

    expect(questionApi.updateUnsolvedQuestion).toHaveBeenCalledWith('MG-AIA-01-TH', {
      reviewStatus: 'REVIEWED',
      reviewNotes: 'Verified diaphragm placement with mentor.',
    });

    expect(harness.get().items[0].record.reviewStatus).toBe('REVIEWED');
    expect(harness.get().items[0].record.reviewNotes).toBe('Verified diaphragm placement with mentor.');
  });

  // =========================================================================
  // 6. SAFE OPTIMISTIC ROLLBACK ON FAILED UPDATE
  // =========================================================================
  it('Scenario 6: Safely rolls back optimistic update to previous state if PATCH request rejects', async () => {
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [mockUnsolvedItem],
      totalCount: 1,
    });

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    expect(harness.get().items[0].record.reviewStatus).toBe('UNREVIEWED');

    // Mock failed backend update
    vi.mocked(questionApi.updateUnsolvedQuestion).mockRejectedValue(
      new Error('Network error: 500 Internal Server Error')
    );

    let caughtError: any = null;
    try {
      await harness.get().updateReview('MG-AIA-01-TH', { reviewStatus: 'BOOKMARKED' });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeDefined();
    // Verification of rollback: reviewStatus rolled back to UNREVIEWED!
    expect(harness.get().items[0].record.reviewStatus).toBe('UNREVIEWED');
  });

  // =========================================================================
  // 7. FILTERING FUNCTIONALITY
  // =========================================================================
  it('Scenario 7: Accurately filters items by reviewStatus without mutating master items list', async () => {
    const item1 = { ...mockUnsolvedItem, record: { ...mockUnsolvedItem.record, id: 'Q1', reviewStatus: 'UNREVIEWED' as const } };
    const item2 = { ...mockUnsolvedItem, record: { ...mockUnsolvedItem.record, id: 'Q2', reviewStatus: 'REVIEWED' as const } };
    const item3 = { ...mockUnsolvedItem, record: { ...mockUnsolvedItem.record, id: 'Q3', reviewStatus: 'BOOKMARKED' as const } };

    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [item1, item2, item3],
      totalCount: 3,
    });

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    expect(harness.get().items).toHaveLength(3);
    expect(harness.get().filteredItems).toHaveLength(3);

    // Filter by REVIEWED
    harness.get().setActiveFilter('REVIEWED');
    expect(harness.get().filteredItems).toHaveLength(1);
    expect(harness.get().filteredItems[0].record.id).toBe('Q2');

    // Filter by BOOKMARKED
    harness.get().setActiveFilter('BOOKMARKED');
    expect(harness.get().filteredItems).toHaveLength(1);
    expect(harness.get().filteredItems[0].record.id).toBe('Q3');

    // Master items array remains untouched
    expect(harness.get().items).toHaveLength(3);
  });

  // =========================================================================
  // 8. SESSION & GAMIFICATION ISOLATION
  // =========================================================================
  it('Scenario 8: Preserves session isolation and awards zero XP when reviewing unsolved vault items', async () => {
    vi.mocked(questionApi.getUnsolvedQuestions).mockResolvedValue({
      success: true,
      unsolvedQuestions: [mockUnsolvedItem],
      totalCount: 1,
    });
    vi.mocked(questionApi.updateUnsolvedQuestion).mockResolvedValue({
      success: true,
      updatedRecord: {
        ...mockUnsolvedItem.record,
        reviewStatus: 'REVIEWED',
        reviewedAt: '2026-10-12T12:00:00.000Z',
        updatedAt: '2026-10-12T12:00:00.000Z',
      },
    });

    const harness = createHookHarness(() => useUnsolvedQuestions());
    await harness.get().refetch();

    // Perform review action
    await harness.get().updateReview('MG-AIA-01-TH', { reviewStatus: 'REVIEWED' });

    // Invariant: Unsolved question reviews must NEVER invoke daily session submission or finalization APIs
    expect(sessionApi.recordAttempt).not.toHaveBeenCalled();
    expect(sessionApi.finalizeSession).not.toHaveBeenCalled();
    expect(sessionApi.getTodaySession).not.toHaveBeenCalled();

    // Verify only the question review endpoint was called
    expect(questionApi.updateUnsolvedQuestion).toHaveBeenCalledTimes(1);
    expect(questionApi.updateUnsolvedQuestion).toHaveBeenCalledWith('MG-AIA-01-TH', {
      reviewStatus: 'REVIEWED',
    });
  });
});
