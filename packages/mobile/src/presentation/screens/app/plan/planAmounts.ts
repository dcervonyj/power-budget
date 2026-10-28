import {
  formatMoneyInput,
  getCurrency,
  isSupportedCurrency,
  parseMinorUnits,
  parseMoney,
} from '@power-budget/core';
import type { PlannedItemDto } from '@power-budget/shared-app/contract';

/** A stepper press moves a limit by this many major units (10 zł, 10 €, ...). */
const STEP_MAJOR_UNITS = 10n;

export interface PlanTotals {
  readonly currency: string;
  readonly incomeMinor: bigint;
  readonly expensesMinor: bigint;
  /** Income minus planned expenses (negative = over-planned). */
  readonly leftMinor: bigint;
  /** Items in another currency or with an unreadable amount; they are not summed (no FX here). */
  readonly excludedCount: number;
}

/** Exact minor units as the API's integer string, or null when the input is not an amount. */
export function toMinorUnitsString(amount: string, currency: string): string | null {
  if (!isSupportedCurrency(currency)) {
    return null;
  }
  try {
    return parseMoney(amount, currency).toString();
  } catch {
    return null;
  }
}

/** Minor units (API integer string) as major-unit input text, with the currency's exponent. */
export function toAmountInput(amountMinor: string, currency: string): string {
  if (!isSupportedCurrency(currency)) {
    return '';
  }
  try {
    return formatMoneyInput(parseMinorUnits(amountMinor), currency);
  } catch {
    return '';
  }
}

/** One stepper press in minor units of the currency, or null for a currency we cannot format. */
export function stepMinorUnits(currency: string): number | null {
  if (!isSupportedCurrency(currency)) {
    return null;
  }

  return Number(STEP_MAJOR_UNITS * 10n ** BigInt(getCurrency(currency).minorUnitExponent));
}

/** The amount as a number for the stepper, or null when it is not a safe integer. */
export function toSteppableMinor(amountMinor: string): number | null {
  const value = Number(amountMinor);

  return Number.isSafeInteger(value) ? value : null;
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
