import type { Money } from '../domain/shared/money.js';
import type { CurrencyCode } from '../domain/shared/currency.js';
import type { IsoDate } from '../domain/shared/ids.js';
import { CURRENCIES } from '../domain/shared/currency.js';

export type SupportedLocale = 'en' | 'uk' | 'ru' | 'pl';

const LOCALE_BCP47: Record<SupportedLocale, string> = {
  en: 'en-GB',
  uk: 'uk-UA',
  ru: 'ru-RU',
  pl: 'pl-PL',
};

function getExponent(currency: CurrencyCode): number {
  return CURRENCIES[currency]?.minorUnitExponent ?? 2;
}

/**
 * Format a Money value for display using Intl.NumberFormat.
 * Converts from minor units using the currency's exponent.
 * Example: { amountMinor: 1000n, currency: 'PLN' } → "10,00 zł" (pl)
 */
export function formatMoney(money: Money, locale: SupportedLocale): string {
  const exponent = getExponent(money.currency);
  const divisor = Math.pow(10, exponent);
  const amount = Number(money.amountMinor) / divisor;

  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(amount);
}

/**
 * Format an IsoDate string ('YYYY-MM-DD') or Date for display.
 * Uses Intl.DateTimeFormat with medium date style.
 */
export function formatDate(date: IsoDate | Date, locale: SupportedLocale): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00Z') : date;
  return new Intl.DateTimeFormat(LOCALE_BCP47[locale], {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Format a plain number for display (e.g. count, percentage).
 * Uses Intl.NumberFormat with up to 2 decimal places.
 */
export function formatNumber(n: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    maximumFractionDigits: 2,
  }).format(n);
}
