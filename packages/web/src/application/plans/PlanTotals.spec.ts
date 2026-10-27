import { describe, expect, it } from 'vitest';
import type { PlannedItemDto } from '@power-budget/shared-app/contract';
import { computePlanTotals } from './PlanTotals.js';

function item(
  direction: PlannedItemDto['direction'],
  amountMinor: string,
  currency: string,
): PlannedItemDto {
  return {
    id: `${direction}-${amountMinor}-${currency}`,
    planId: 'plan-1',
    categoryId: 'cat-1',
    direction,
    amount: { amountMinor, currency },
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('computePlanTotals', () => {
  it('sums income and expenses in exact minor units and subtracts', () => {
    const totals = computePlanTotals(
      [
        item('income', '840000', 'PLN'),
        item('income', '460000', 'PLN'),
        item('expense', '340000', 'PLN'),
      ],
      'PLN',
    );

    expect(totals).toEqual({
      currency: 'PLN',
      incomeMinor: 1300000n,
      expensesMinor: 340000n,
      leftMinor: 960000n,
      excludedCount: 0,
    });
  });

  it('goes negative when expenses exceed income', () => {
    const totals = computePlanTotals(
      [item('income', '100', 'PLN'), item('expense', '250', 'PLN')],
      'PLN',
    );

    expect(totals.leftMinor).toBe(-150n);
  });

  it('leaves items in another currency out and counts them', () => {
    const totals = computePlanTotals(
      [item('expense', '1000', 'EUR'), item('expense', '500', 'PLN')],
      'PLN',
    );

    expect(totals.expensesMinor).toBe(500n);
    expect(totals.excludedCount).toBe(1);
  });

  it('counts an item with an unreadable amount as excluded, not as zero', () => {
    const totals = computePlanTotals([item('expense', 'abc', 'PLN')], 'PLN');

    expect(totals.expensesMinor).toBe(0n);
    expect(totals.excludedCount).toBe(1);
  });
});
