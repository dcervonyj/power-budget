import { CURRENCIES, IsoDate, IsoDateTime, isSupportedCurrency } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';

/**
 * Row value constructors (audit L7): rows are mapped through the core
 * constructors, which validate, instead of `as <Brand>` casts.
 */
export function isoDateTimeOf(value: Date): IsoDateTime {
  return IsoDateTime.of(value.toISOString());
}

export function nullableIsoDateTimeOf(value: Date | null): IsoDateTime | null {
  return value === null ? null : isoDateTimeOf(value);
}

/** Postgres `date` columns come back as `YYYY-MM-DD` strings. */
export function isoDateOf(value: string): IsoDate {
  return IsoDate.of(value);
}

/** The currency codes `currencyOf` accepts: SQL filters use it to leave other rows out (CLN-039). */
export const SUPPORTED_CURRENCY_CODES: readonly string[] = Object.keys(CURRENCIES);

export function currencyOf(value: string): CurrencyCode {
  const code = value.trim().toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new Error(`Unsupported currency in row: ${JSON.stringify(value)}`);
  }

  return code;
}

/** The one row an `insert ... returning()` yields; an empty result is a broken insert, not a value to default. */
export function insertedRow<T>(rows: readonly T[], label: string): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error(`Insert of ${label} returned no row`);
  }

  return row;
}

/** Narrows a text column to one of the allowed literals, or throws. */
export function oneOf<T extends string>(allowed: readonly T[], value: string, label: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new Error(`Unknown ${label} in row: ${JSON.stringify(value)}`);
  }

  return match;
}
