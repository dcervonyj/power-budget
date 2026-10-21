import type { CurrencyCode } from '@power-budget/core';

/** Currencies the app must be able to convert; quoted against EUR (1 EUR = x). */
export const FX_REQUIRED_QUOTES: readonly CurrencyCode[] = ['PLN', 'USD', 'GBP', 'UAH'];

/** A rate stays usable for this many days after its publication (weekends, holidays). */
export const FX_CARRY_FORWARD_DAYS = 7;

/** fx_rates.rate is numeric(24, 10): derived rates are rounded to 10 fraction digits. */
export const FX_RATE_FRACTION_DIGITS = 10;
