import { NO_LABEL } from '../../../../domain/display.js';
import { IsoDate, parseMinorUnits, periodProgress } from '@power-budget/core';
import type {
  AccountDto,
  CategoryDto,
  PlanDashboardResponseDto,
  PlanDto,
} from '@power-budget/shared-app/contract';
import type { AccountOption, CategoryOption, PlanSnapshot } from './addExpenseModel.js';

export const UNPLANNED_ID = 'unplanned';

export interface AddExpenseData {
  /** Null when today is outside the plan period: no lens, no safe to spend (Q4). */
  readonly plan: PlanSnapshot | null;
  readonly currency: string;
  readonly categories: readonly CategoryOption[];
  readonly accounts: readonly AccountOption[];
}

export interface AddExpenseSources {
  readonly plan: PlanDto;
  readonly dashboard: PlanDashboardResponseDto;
  readonly categories: readonly CategoryDto[];
  readonly accounts: readonly AccountDto[];
  /** Label of the unplanned bucket. */
  readonly unplannedName: string;
}

/** Everything the Add screen shows, from the plan dashboard, the categories and the accounts. */
export function buildAddExpenseData(sources: AddExpenseSources): AddExpenseData {
  const { dashboard } = sources;
  const currency = dashboard.baseCurrency;
  const names = new Map(sources.categories.map((category) => [category.id, category.name]));
  const unplanned = parseMinorUnits(dashboard.unplannedExpenses.amountMinor);

  return {
    plan: toSnapshot(sources.plan.name, dashboard, unplanned),
    currency,
    categories: [
      ...dashboard.expenseLines.map((line) => ({
        id: line.plannedItemId,
        plannedItemId: line.plannedItemId,
        name: names.get(line.categoryId) ?? NO_LABEL,
        plannedMinor: parseMinorUnits(line.planned.amountMinor),
        spentMinor: parseMinorUnits(line.actual.amountMinor),
      })),
      {
        id: UNPLANNED_ID,
        plannedItemId: null,
        name: sources.unplannedName,
        plannedMinor: 0n,
        spentMinor: unplanned,
      },
    ],
    accounts: sources.accounts
      .filter((account) => account.currency === currency)
      .map((account) => ({ id: account.id, name: account.name, currency: account.currency })),
  };
}

function toSnapshot(
  planName: string,
  dashboard: PlanDashboardResponseDto,
  unplanned: bigint,
): PlanSnapshot | null {
  const progress = periodProgress(
    {
      kind: 'custom',
      range: {
        start: IsoDate.of(dashboard.period.start),
        end: IsoDate.of(dashboard.period.end),
      },
    },
    IsoDate.of(dashboard.asOf),
  );
  if (progress.state !== 'current') {
    return null;
  }

  return {
    planName,
    currency: dashboard.baseCurrency,
    plannedMinor: parseMinorUnits(dashboard.totalPlannedExpenses.amountMinor),
    spentMinor: parseMinorUnits(dashboard.totalActualExpenses.amountMinor) + unplanned,
    daysLeft: progress.daysLeft,
  };
}
