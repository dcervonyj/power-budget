import type { PlanId, PlannedItemId } from '../plans/ids.js';
import type { CategoryId } from '../categories/ids.js';
import type { Money } from '../shared/money.js';
import type { PlannedDirection } from '../plans/enums.js';
import type { IsoDate } from '../shared/ids.js';
import type { DateRange } from '../shared/date-range.js';
import type { CurrencyCode } from '../shared/currency.js';

export type ProgressBand = 'ok' | 'warning' | 'over';

export interface PlannedItemActuals {
  readonly plannedItemId: PlannedItemId;
  readonly categoryId: CategoryId;
  readonly direction: PlannedDirection;
  readonly planned: Money;
  readonly actual: Money;
  readonly remaining: Money;
  readonly progressBand: ProgressBand;
}

export interface PlanActualsView {
  readonly planId: PlanId;
  readonly period: DateRange;
  readonly baseCurrency: CurrencyCode;
  readonly incomeLines: readonly PlannedItemActuals[];
  readonly expenseLines: readonly PlannedItemActuals[];
  readonly totalPlannedIncome: Money;
  readonly totalActualIncome: Money;
  readonly totalPlannedExpenses: Money;
  readonly totalActualExpenses: Money;
  readonly unplannedExpenses: Money;
  readonly unplannedIncome: Money;
  readonly net: Money;
  readonly asOf: IsoDate;
}
