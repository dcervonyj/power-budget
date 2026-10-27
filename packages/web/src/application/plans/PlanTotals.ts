import type { PlannedItemDto } from '@power-budget/shared-app/contract';

export interface PlanTotals {
  readonly currency: string;
  readonly incomeMinor: bigint;
  readonly expensesMinor: bigint;
  /** Income minus planned expenses: what is left to plan (negative = over-planned). */
  readonly leftMinor: bigint;
  /** Items in another currency or with an unreadable amount; they are not summed (no FX here). */
  readonly excludedCount: number;
}

/** Totals of the plan items that are in the plan's base currency, in exact minor units. */
export function computePlanTotals(
  items: readonly PlannedItemDto[],
  baseCurrency: string,
): PlanTotals {
  const counted = items.filter((item) => isCounted(item, baseCurrency));
  const incomeMinor = sumMinor(counted, 'income');
  const expensesMinor = sumMinor(counted, 'expense');

  return {
    currency: baseCurrency,
    incomeMinor,
    expensesMinor,
    leftMinor: incomeMinor - expensesMinor,
    excludedCount: items.length - counted.length,
  };
}

function isCounted(item: PlannedItemDto, baseCurrency: string): boolean {
  return item.amount.currency === baseCurrency && /^-?\d+$/.test(item.amount.amountMinor);
}

function sumMinor(
  items: readonly PlannedItemDto[],
  direction: PlannedItemDto['direction'],
): bigint {
  return items
    .filter((item) => item.direction === direction)
    .reduce((sum, item) => sum + BigInt(item.amount.amountMinor), 0n);
}
