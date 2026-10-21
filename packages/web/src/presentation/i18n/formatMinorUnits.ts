import { formatMoney } from '@power-budget/core';
import { toSupportedLocale } from './supportedLocale.js';

/**
 * Format whole minor units (as numbers in the dashboard view) with the currency's
 * exponent through core formatMoney, instead of `amount / 100`.
 */
export function formatMinorUnits(amountMinor: number, currency: string, locale: string): string {
  return formatMoney(
    { amountMinor: BigInt(Math.round(amountMinor)), currency },
    toSupportedLocale(locale),
  );
}
