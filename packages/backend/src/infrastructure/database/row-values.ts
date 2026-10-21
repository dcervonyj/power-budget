import { IsoDate, IsoDateTime, isSupportedCurrency } from '@power-budget/core';
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

export function currencyOf(value: string): CurrencyCode {
  const code = value.trim().toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new Error(`Unsupported currency in row: ${JSON.stringify(value)}`);
  }

  return code;
}

/** Narrows a text column to one of the allowed literals, or throws. */
export function oneOf<T extends string>(allowed: readonly T[], value: string, label: string): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) {
    throw new Error(`Unknown ${label} in row: ${JSON.stringify(value)}`);
  }

  return match;
}
