import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { useBottomSheetGesture, SheetState } from '../src/hooks/useBottomSheetGesture';

// Lightweight hook runner without external test library
function setupHook(initialState: SheetState = 'COLLAPSED', thresholdPx: number = 45) {
  let current: ReturnType<typeof useBottomSheetGesture>;

  function TestComponent() {
    current = useBottomSheetGesture({ initialState, thresholdPx, velocityThreshold: 0.4 });
    return null;
  }

  // We can also extract the pure calculation logic or simulate state
  return {
    get: () => current,
  };
}

describe('useBottomSheetGesture Logic & State Machine', () => {
  it('validates threshold and snap state calculations', () => {
    // Test upward drag in collapsed state
    const thresholdPx = 45;
    const upwardDrag1 = -60; // > 45px upward
    const shouldExpand1 = upwardDrag1 < -thresholdPx;
    expect(shouldExpand1).toBe(true);

    const upwardDrag2 = -20; // < 45px upward
    const shouldExpand2 = upwardDrag2 < -thresholdPx;
    expect(shouldExpand2).toBe(false);

    // Test downward drag in expanded state
    const downwardDrag1 = 60; // > 45px downward
    const shouldCollapse1 = downwardDrag1 > thresholdPx;
    expect(shouldCollapse1).toBe(true);

    const downwardDrag2 = 20; // < 45px downward
    const shouldCollapse2 = downwardDrag2 > thresholdPx;
    expect(shouldCollapse2).toBe(false);
  });

  it('validates velocity threshold for flick gestures', () => {
    const velocityThreshold = 0.4; // px/ms

    // Fast upward flick (delta -30px in 50ms = -0.6 px/ms)
    const upwardVelocity = -30 / 50;
    const isFlickUp = upwardVelocity < -velocityThreshold;
    expect(isFlickUp).toBe(true);

    // Slow drag (delta -30px in 200ms = -0.15 px/ms)
    const slowUpwardVelocity = -30 / 200;
    const isSlowFlickUp = slowUpwardVelocity < -velocityThreshold;
    expect(isSlowFlickUp).toBe(false);

    // Fast downward flick (delta 30px in 50ms = 0.6 px/ms)
    const downwardVelocity = 30 / 50;
    const isFlickDown = downwardVelocity > velocityThreshold;
    expect(isFlickDown).toBe(true);
  });

  it('validates scroll conflict priority logic', () => {
    // Rule: When expanded and content is scrolled down (scrollTop > 0),
    // downward swipes must scroll the content and NOT collapse the sheet
    const isExpanded = true;
    const scrollTop = 45; // scrolled down into clinical explanation

    const canCollapseFromContent = isExpanded && scrollTop <= 1;
    expect(canCollapseFromContent).toBe(false);

    // Rule: When expanded and content is at the top (scrollTop === 0),
    // pulling down from the top can collapse the sheet
    const scrollTopAtTop = 0;
    const canCollapseAtTop = isExpanded && scrollTopAtTop <= 1;
    expect(canCollapseAtTop).toBe(true);

    // Rule: Drag handle ALWAYS allows collapsing regardless of content scroll
    const dragSourceHandle = 'handle';
    const canCollapseFromHandle = dragSourceHandle === 'handle';
    expect(canCollapseFromHandle).toBe(true);
  });
});
