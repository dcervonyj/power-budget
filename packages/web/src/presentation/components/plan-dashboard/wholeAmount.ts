import { formatMoneyParts, type MoneyPart, type SupportedLocale } from '@power-budget/core';
import type { MoneyAmount } from '../../../domain/dashboard/PlanDashboard.js';

const FRACTION_PARTS: ReadonlySet<string> = new Set(['decimal', 'fraction']);
const AFFIX_PARTS: ReadonlySet<string> = new Set(['currency', 'literal']);

/**
 * A money amount in whole units ("477", "9 906 zł"): the fraction is dropped, so the amount must
 * already be whole or rounded the way the caller wants (a daily allowance rounds down).
 */
export function formatWholeAmount(
  money: MoneyAmount,
  locale: SupportedLocale,
  withCurrency: boolean,
): string {
  return formatMoneyParts(money, locale)
    .filter((part) => keepPart(part, withCurrency))
    .map((part) => part.value)
    .join('')
    .trim();
}

/** The currency's narrow symbol in the locale ("zł", "€"), e.g. for "zł a day". */
export function currencySymbol(currency: string, locale: SupportedLocale): string {
  const part = formatMoneyParts({ amountMinor: 0n, currency }, locale).find(isCurrencyPart);

  return part === undefined ? currency : part.value;
}

function keepPart(part: MoneyPart, withCurrency: boolean): boolean {
  if (FRACTION_PARTS.has(part.type)) {
    return false;
  }

  return withCurrency || !AFFIX_PARTS.has(part.type);
}

function isCurrencyPart(part: MoneyPart): boolean {
  return part.type === 'currency';
}
