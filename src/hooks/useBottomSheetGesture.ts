import { useState, useRef, useCallback } from 'react';

export type SheetState = 'COLLAPSED' | 'EXPANDED';

export interface UseBottomSheetGestureOptions {
  initialState?: SheetState;
  thresholdPx?: number;
  velocityThreshold?: number; // px/ms
  onStateChange?: (state: SheetState) => void;
}

export interface UseBottomSheetGestureReturn {
  sheetState: SheetState;
  setSheetState: (state: SheetState) => void;
  toggleSheetState: () => void;
  isDragging: boolean;
  dragOffsetY: number;
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  contentProps: {
    ref: React.RefObject<HTMLDivElement>;
    onPointerDown: (e: React.PointerEvent) => void;
    onScroll: () => void;
  };
  containerProps: {
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useBottomSheetGesture({
  initialState = 'COLLAPSED',
  thresholdPx = 45,
  velocityThreshold = 0.4,
  onStateChange,
}: UseBottomSheetGestureOptions = {}): UseBottomSheetGestureReturn {
  const [sheetState, setSheetStateInternal] = useState<SheetState>(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const isGestureActiveRef = useRef(false);
  const dragSourceRef = useRef<'handle' | 'content'>('handle');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const currentScrollTopRef = useRef(0);

  // Sync state changes with callback
  const setSheetState = useCallback(
    (nextState: SheetState) => {
      setSheetStateInternal(nextState);
      if (onStateChange) {
        onStateChange(nextState);
      }
    },
    [onStateChange]
  );

  const toggleSheetState = useCallback(() => {
    setSheetState(sheetState === 'COLLAPSED' ? 'EXPANDED' : 'COLLAPSED');
  }, [sheetState, setSheetState]);

  // Track scroll position of the internal content
  const handleContentScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      currentScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
  }, []);

  // Gesture Start from Drag Handle / Header Area
  const handlePointerDownHandle = useCallback(
    (e: React.PointerEvent) => {
      startYRef.current = e.clientY;
      startTimeRef.current = performance.now();
      isGestureActiveRef.current = true;
      dragSourceRef.current = 'handle';
      setIsDragging(true);
      setDragOffsetY(0);
    },
    []
  );

  // Gesture Start from Scrollable Content Area
  const handlePointerDownContent = useCallback(
    (e: React.PointerEvent) => {
      startYRef.current = e.clientY;
      startTimeRef.current = performance.now();
      isGestureActiveRef.current = true;
      dragSourceRef.current = 'content';
      setDragOffsetY(0);

      if (scrollContainerRef.current) {
        currentScrollTopRef.current = scrollContainerRef.current.scrollTop;
      }
    },
    []
  );

  // Gesture Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isGestureActiveRef.current) return;

      const currentY = e.clientY;
      const deltaY = currentY - startYRef.current;

      if (sheetState === 'COLLAPSED') {
        // In collapsed state, dragging upward (deltaY < 0) pulls the sheet up
        if (deltaY < 0) {
          setIsDragging(true);
          // Resistance damping
          setDragOffsetY(Math.max(-200, deltaY));
        }
      } else {
        // In expanded state, dragging downward (deltaY > 0) pulls the sheet down
        // Only if started on handle OR content is at scrollTop <= 0
        const isAtTop = currentScrollTopRef.current <= 1;
        if (deltaY > 0 && (dragSourceRef.current === 'handle' || isAtTop)) {
          setIsDragging(true);
          setDragOffsetY(Math.min(200, deltaY));
        }
      }
    },
    [sheetState]
  );

  // Gesture End / Release
  const handlePointerEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!isGestureActiveRef.current) return;

      const currentY = e.clientY;
      const deltaY = currentY - startYRef.current;
      const durationMs = Math.max(1, performance.now() - startTimeRef.current);
      const velocity = deltaY / durationMs; // px/ms

      isGestureActiveRef.current = false;
      setIsDragging(false);
      setDragOffsetY(0);

      if (sheetState === 'COLLAPSED') {
        // Upward drag threshold or upward flick velocity
        if (deltaY < -thresholdPx || velocity < -velocityThreshold) {
          setSheetState('EXPANDED');
        }
      } else {
        // Downward drag threshold or downward flick velocity
        const isAtTop = currentScrollTopRef.current <= 1;
        if (
          (deltaY > thresholdPx || velocity > velocityThreshold) &&
          (dragSourceRef.current === 'handle' || isAtTop)
        ) {
          setSheetState('COLLAPSED');
        }
      }
    },
    [sheetState, thresholdPx, velocityThreshold, setSheetState]
  );

  return {
    sheetState,
    setSheetState,
    toggleSheetState,
    isDragging,
    dragOffsetY,
    handleProps: {
      onPointerDown: handlePointerDownHandle,
    },
    contentProps: {
      ref: scrollContainerRef,
      onPointerDown: handlePointerDownContent,
      onScroll: handleContentScroll,
    },
    containerProps: {
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  };
}
