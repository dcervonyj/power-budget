import { describe, expect, it } from 'vitest';
import { UnknownCategoryError } from '../../../../../domain/categoryName.js';
import { buildAddExpenseData } from '../addExpenseData.js';

describe('buildAddExpenseData', () => {
  it('rejects an expense line whose category the list lacks', () => {
    const money = { amountMinor: '100', currency: 'PLN' };
    const dashboard = {
      baseCurrency: 'PLN',
      expenseLines: [
        {
          plannedItemId: 'i1',
          categoryId: 'c-gone',
          direction: 'expense',
          planned: money,
          actual: money,
        },
      ],
      unplannedExpenses: money,
      totalPlannedExpenses: money,
      totalActualExpenses: money,
      period: { start: '2026-10-01', end: '2026-10-31' },
      asOf: '2026-10-15',
    };

    expect(() =>
      buildAddExpenseData({
        plan: { name: 'October' },
        dashboard,
        categories: [],
        accounts: [],
        unplannedName: 'Unplanned',
      } as never),
    ).toThrow(UnknownCategoryError);
  });
});
