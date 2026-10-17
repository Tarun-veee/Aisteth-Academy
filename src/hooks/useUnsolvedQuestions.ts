import { useState, useEffect, useCallback, useMemo } from 'react';
import { questionApi, UpdateUnsolvedQuestionApiPayload } from '../api/questionApi';
import { UnsolvedQuestionItem, ReviewStatus } from '../models/session.types';

export interface UseUnsolvedQuestionsReturn {
  items: UnsolvedQuestionItem[];
  filteredItems: UnsolvedQuestionItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  activeFilter: 'ALL' | ReviewStatus;
  setActiveFilter: (filter: 'ALL' | ReviewStatus) => void;
  refetch: () => Promise<void>;
  updateReview: (
    questionId: string,
    updates: UpdateUnsolvedQuestionApiPayload
  ) => Promise<boolean>;
}

export function useUnsolvedQuestions(): UseUnsolvedQuestionsReturn {
  const [items, setItems] = useState<UnsolvedQuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | ReviewStatus>('ALL');

  const fetchUnsolvedQuestions = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);
    try {
      const res = await questionApi.getUnsolvedQuestions();
      setItems(Array.isArray(res?.unsolvedQuestions) ? res.unsolvedQuestions : []);
    } catch (err: any) {
      console.warn('[useUnsolvedQuestions] fetch error:', err);
      setIsError(true);
      setErrorMessage(err?.message || 'Unable to load unsolved clinical questions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnsolvedQuestions();
  }, [fetchUnsolvedQuestions]);

  const updateReview = useCallback(
    async (
      questionId: string,
      updates: UpdateUnsolvedQuestionApiPayload
    ): Promise<boolean> => {
      // Snapshot previous state for safe optimistic rollback (Requirement 10)
      let rollbackItems: UnsolvedQuestionItem[] = [];
      setItems((prev) => {
        rollbackItems = prev;
        return prev.map((item) => {
          if (item.record.id === questionId) {
            return {
              ...item,
              record: {
                ...item.record,
                ...updates,
                reviewedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            };
          }
          return item;
        });
      });

      try {
        const res = await questionApi.updateUnsolvedQuestion(questionId, updates);
        // Synchronize with server-authoritative record
        if (res && res.updatedRecord) {
          setItems((prev) =>
            prev.map((item) =>
              item.record.id === questionId
                ? { ...item, record: res.updatedRecord }
                : item
            )
          );
        }
        return true;
      } catch (err: any) {
        console.warn(`[useUnsolvedQuestions] update error for ${questionId}:`, err);
        // Rollback optimistic state
        setItems(rollbackItems);
        setErrorMessage(err?.message || 'Failed to update review status.');
        throw err;
      }
    },
    []
  );

  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return items;
    return items.filter((item) => item.record.reviewStatus === activeFilter);
  }, [items, activeFilter]);

  return {
    items,
    filteredItems,
    isLoading,
    isError,
    errorMessage,
    activeFilter,
    setActiveFilter,
    refetch: fetchUnsolvedQuestions,
    updateReview,
  };
}
