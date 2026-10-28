import { describe, expect, it } from 'vitest';
import type { PlanDashboardResponseDto } from '@power-budget/shared-app/contract';
import { UnknownCategoryError } from '../../../domain/categoryName.js';
import { DashboardView } from '../DashboardView.js';

const money = (amountMinor: string): { amountMinor: string; currency: 'PLN' } => ({
  amountMinor,
  currency: 'PLN',
});

const dto: PlanDashboardResponseDto = {
  planId: 'plan-1',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [],
  expenseLines: [
    {
      plannedItemId: 'item-1',
      categoryId: 'cat-1',
      direction: 'expense',
      planned: money('90000000000000000'),
      actual: money('45000000000000000'),
      remaining: money('45000000000000000'),
      progressBand: 'ok',
    },
    {
      plannedItemId: 'item-2',
      categoryId: 'cat-2',
      direction: 'expense',
      planned: money('0'),
      actual: money('500'),
      remaining: money('-500'),
      progressBand: 'over',
    },
  ],
  totalPlannedIncome: money('0'),
  totalActualIncome: money('0'),
  totalPlannedExpenses: money('0'),
  totalActualExpenses: money('0'),
  unplannedExpenses: money('4200'),
  unplannedIncome: money('0'),
  net: money('-500'),
  asOf: '2026-10-15',
};

describe('DashboardView.fromDto', () => {
  it('rejects a line whose category is not in the name map', () => {
    expect(() => DashboardView.fromDto(dto, new Map([['cat-1', 'Food']]))).toThrow(
      UnknownCategoryError,
    );
  });

  it('maps lines, names and the period from the contract shape', () => {
    const view = DashboardView.fromDto(
      dto,
      new Map([
        ['cat-1', 'Food'],
        ['cat-2', 'Rent'],
      ]),
    );

    expect(view.periodStart).toBe('2026-10-01');
    expect(view.periodEnd).toBe('2026-10-31');
    expect(view.incomeRows).toEqual([]);
    expect(view.expenseRows.map((row) => row.name)).toEqual(['Food', 'Rent']);
    expect(view.net).toEqual(money('-500'));
    expect(view.unplannedExpenses).toEqual(money('4200'));
  });

  it('computes the ratio from exact bigints and is 0 when nothing is planned', () => {
    const view = DashboardView.fromDto(
      dto,
      new Map([
        ['cat-1', 'Food'],
        ['cat-2', 'Rent'],
      ]),
    );

    expect(view.expenseRows.map((row) => row.ratio)).toEqual([0.5, 0]);
  });
});
