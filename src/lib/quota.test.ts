import { describe, it, expect } from 'vitest';
import { estimateLookupCost, canSpendPure, pacificDateKey, DAILY_BUDGET, SAFETY_MARGIN, COST } from './quota';

describe('quota math', () => {
  it('estimates a 5-seed lookup at ~504 units', () => {
    // 2 list + 5 search + ~2 list = 4*1 + 500 = 504
    expect(estimateLookupCost(5)).toBe(4 * COST.list + 5 * COST.search);
  });

  it('blocks spending that would cross the safety margin', () => {
    expect(canSpendPure(DAILY_BUDGET - SAFETY_MARGIN - 504, 504)).toBe(true);
    expect(canSpendPure(DAILY_BUDGET - SAFETY_MARGIN - 503, 504)).toBe(false);
    expect(canSpendPure(0, DAILY_BUDGET)).toBe(false);
  });

  it('produces a YYYY-MM-DD pacific date key', () => {
    expect(pacificDateKey(new Date('2026-09-26T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
