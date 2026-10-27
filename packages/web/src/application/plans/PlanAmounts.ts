import {
  formatMoneyInput,
  getCurrency,
  isSupportedCurrency,
  parseMinorUnits,
  parseMoney,
} from '@power-budget/core';
import type { PlannedItemDto } from '@power-budget/shared-app/contract';

/** A stepper click moves a limit by this many major units (10 zł, 10 €, ...). */
const STEP_MAJOR_UNITS = 10n;

/** Exact minor units as the API's integer string, or null when the input is not an amount. */
export function toMinorUnitsString(amount: string, currency: string): string | null {
  if (!currency) {
    return null;
  }
  try {
    return parseMoney(amount, currency).toString();
  } catch {
    return null;
  }
}

/** The stored amount of an item in major units for an input field ("3000.00"). */
export function toAmountInput(item: PlannedItemDto): string {
  try {
    return formatMoneyInput(parseMinorUnits(item.amount.amountMinor), item.amount.currency);
  } catch {
    return '';
  }
}

/** One stepper click in minor units of the currency, or null for a currency we cannot format. */
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
