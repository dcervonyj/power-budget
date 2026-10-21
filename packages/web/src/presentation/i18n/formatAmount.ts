import { formatDate, formatMoney } from '@power-budget/core';
import type { MoneyAmount } from '../../domain/dashboard/PlanDashboard.js';
import { toSupportedLocale } from './supportedLocale.js';

/** Exact minor units in the locale's money format ("1 234,56 zł"), through core formatMoney. */
export function formatAmount(money: MoneyAmount, locale: string): string {
  return formatMoney(money, toSupportedLocale(locale));
}

/** A money amount with its sign spelled out ("+120,00 zł", "−45,10 zł"). */
export function formatSignedAmount(money: MoneyAmount, locale: string): string {
  if (money.amountMinor > 0n) {
    return `+${formatAmount(money, locale)}`;
  }

  return formatAmount(money, locale);
}

/** An ISO date (YYYY-MM-DD) in the locale's short date format. */
export function formatIsoDate(isoDate: string, locale: string): string {
  return formatDate(new Date(`${isoDate}T00:00:00Z`), toSupportedLocale(locale));
}
