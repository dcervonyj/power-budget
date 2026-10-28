import type {
  MoneyDto,
  PlanDashboardResponseDto,
  PlannedItemActualsDto,
} from '@power-budget/shared-app/contract';
import { toOverviewModel, type OverviewModel } from './overviewModel.js';

/**
 * D7 spec sample month (docs/handoff/design-directions/D7-spec/D7-SPEC.md, "Data"): 22 Oct 2026,
 * day 22 of 31; planned 11 800, spent 7 030 (6 605 in categories + 425 unplanned), left 4 770.
 * Used by the gallery and the RNTL specs; never shipped as data.
 */
export function pln(amountMinor: bigint): MoneyDto {
  return { amountMinor: String(amountMinor), currency: 'PLN' };
}

function line(
  categoryId: string,
  direction: 'income' | 'expense',
  planned: bigint,
  actual: bigint,
  progressBand: PlannedItemActualsDto['progressBand'],
): PlannedItemActualsDto {
  return {
    plannedItemId: `d7-item-${categoryId}`,
    categoryId,
    direction,
    planned: pln(planned),
    actual: pln(actual),
    remaining: pln(planned - actual),
    progressBand,
  };
}

export const D7_DASHBOARD: PlanDashboardResponseDto = {
  planId: 'plan-d7',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [
    line('d7-salary', 'income', 1300000n, 1300000n, 'over'),
    line('d7-freelance', 'income', 120000n, 0n, 'ok'),
  ],
  expenseLines: [
    line('d7-rent', 'expense', 340000n, 340000n, 'over'),
    line('d7-eating-out', 'expense', 50000n, 56250n, 'over'),
    line('d7-groceries', 'expense', 220000n, 114864n, 'ok'),
    line('d7-bills', 'expense', 100000n, 54800n, 'ok'),
    line('d7-transport', 'expense', 70000n, 31239n, 'ok'),
    line('d7-health', 'expense', 40000n, 8990n, 'ok'),
    line('d7-subscriptions', 'expense', 30000n, 11197n, 'ok'),
    line('d7-home', 'expense', 90000n, 4000n, 'ok'),
    line('d7-anna', 'expense', 120000n, 21000n, 'ok'),
    line('d7-marek', 'expense', 120000n, 18160n, 'ok'),
  ],
  totalPlannedIncome: pln(1420000n),
  totalActualIncome: pln(1300000n),
  totalPlannedExpenses: pln(1180000n),
  totalActualExpenses: pln(660500n),
  unplannedExpenses: pln(42500n),
  unplannedIncome: pln(0n),
  net: pln(597000n),
  asOf: '2026-10-22',
};

export const D7_CATEGORY_NAMES: ReadonlyMap<string, string> = new Map([
  ['d7-salary', 'Salaries'],
  ['d7-freelance', 'Freelance'],
  ['d7-rent', 'Rent'],
  ['d7-eating-out', 'Eating out'],
  ['d7-groceries', 'Groceries'],
  ['d7-bills', 'Bills & insurance'],
  ['d7-transport', 'Transport'],
  ['d7-health', 'Health'],
  ['d7-subscriptions', 'Subscriptions'],
  ['d7-home', 'Home'],
  ['d7-anna', 'Anna · personal'],
  ['d7-marek', 'Marek · personal'],
]);

/** The D7 month with optional overrides (e.g. another `asOf` or totals). */
export function d7Model(overrides: Partial<PlanDashboardResponseDto> = {}): OverviewModel {
  return toOverviewModel({ ...D7_DASHBOARD, ...overrides }, 'October', D7_CATEGORY_NAMES);
}
