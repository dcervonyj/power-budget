import type { ProgressBand } from '@power-budget/core';

export type { ProgressBand };

/** Exact minor units with their currency, ready for core formatMoney. */
export interface MoneyAmount {
  readonly amountMinor: bigint;
  readonly currency: string;
}

export type LineDirection = 'income' | 'expense';

/** One planned item: planned vs actual in the plan's base currency. */
export interface DashboardLine {
  readonly plannedItemId: string;
  readonly direction: LineDirection;
  readonly planned: MoneyAmount;
  readonly actual: MoneyAmount;
  readonly remaining: MoneyAmount;
  readonly band: ProgressBand;
  /** The item's own amount when it is planned in another currency than the plan's base. */
  readonly original: MoneyAmount | null;
  /** Empty when the item has no note. */
  readonly note: string;
}

/** The items of one category, with their sums. */
export interface DashboardCategoryGroup {
  readonly categoryId: string;
  /** Empty when the category list could not be loaded. */
  readonly categoryName: string;
  readonly direction: LineDirection;
  readonly planned: MoneyAmount;
  readonly actual: MoneyAmount;
  readonly remaining: MoneyAmount;
  readonly band: ProgressBand;
  readonly lines: readonly DashboardLine[];
}

export interface DashboardTotals {
  readonly plannedIncome: MoneyAmount;
  readonly actualIncome: MoneyAmount;
  readonly plannedExpenses: MoneyAmount;
  readonly actualExpenses: MoneyAmount;
  readonly unplannedIncome: MoneyAmount;
  readonly unplannedExpenses: MoneyAmount;
  /** (actual + unplanned income) - (actual + unplanned expenses). */
  readonly net: MoneyAmount;
}

/** `GET /plans/:id/dashboard` as the plan dashboard shows it. */
export interface PlanDashboard {
  readonly planId: string;
  readonly planName: string;
  readonly planType: 'personal' | 'household';
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly baseCurrency: string;
  /** ISO date the actuals were computed for. */
  readonly asOf: string;
  readonly income: readonly DashboardCategoryGroup[];
  readonly expense: readonly DashboardCategoryGroup[];
  readonly totals: DashboardTotals;
}

/** One of the caller's own transactions with no planned item, in its own currency. */
export interface UnplannedTransaction {
  readonly id: string;
  readonly description: string;
  readonly amount: MoneyAmount;
  readonly occurredOn: string;
}
