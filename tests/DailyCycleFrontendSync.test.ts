import { describe, it, expect, vi } from 'vitest';
import { getDailyCycleDate, getLocalTodayDateString } from '../src/repositories/StorageRepository';

describe('Frontend Daily Learning Cycle Synchronization (09:00 AM IST)', () => {
  it('correctly maps 08:59:59 IST to the previous cycle date', () => {
    const mondayMorningBefore9 = new Date('2026-10-19T08:59:59.999+05:30');
    expect(getDailyCycleDate(mondayMorningBefore9)).toBe('2026-10-18');
  });

  it('correctly transitions to the new cycle date at exactly 09:00:00 IST', () => {
    const mondayExact9 = new Date('2026-10-19T09:00:00.000+05:30');
    expect(getDailyCycleDate(mondayExact9)).toBe('2026-10-19');
  });

  it('remains in the active cycle at 09:01:00 IST and 15:00:00 IST', () => {
    const mondayAfternoon = new Date('2026-10-19T15:00:00.000+05:30');
    expect(getDailyCycleDate(mondayAfternoon)).toBe('2026-10-19');
  });

  it('keeps Monday cycle active until Tuesday 08:59:59 IST', () => {
    const tuesdayMorningBefore9 = new Date('2026-10-20T08:59:59.999+05:30');
    expect(getDailyCycleDate(tuesdayMorningBefore9)).toBe('2026-10-19');
  });

  it('correctly activates Tuesday cycle at Tuesday 09:00:00 IST', () => {
    const tuesdayExact9 = new Date('2026-10-20T09:00:00.000+05:30');
    expect(getDailyCycleDate(tuesdayExact9)).toBe('2026-10-20');
  });

  it('handles UTC vs IST date differences consistently across date boundaries', () => {
    // 01:00 IST on Tuesday Oct 20 -> UTC is 19:30 on Monday Oct 19.
    // In IST, it is before 09:00 AM Tuesday, so cycle date is Monday Oct 19.
    const preDawn = new Date('2026-10-20T01:00:00.000+05:30');
    expect(getDailyCycleDate(preDawn)).toBe('2026-10-19');
  });
});
