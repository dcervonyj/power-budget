import type { IsoDate } from '../domain/shared/ids.js';
import { getMinorUnitExponent } from './money-amount.js';

export type SupportedLocale = 'en' | 'uk' | 'ru' | 'pl';

const LOCALE_BCP47: Record<SupportedLocale, string> = {
  en: 'en-GB',
  uk: 'uk-UA',
  ru: 'ru-RU',
  pl: 'pl-PL',
};

/**
 * Anything with exact minor units: core `Money`, or an API amount after
 * `parseMinorUnits` for a currency core does not list (JPY ...).
 */
export interface MinorUnitAmount {
  readonly amountMinor: bigint;
  readonly currency: string;
}

/**
 * Format a Money value for display using Intl.NumberFormat.
 * Converts from minor units using the currency's exponent.
 * Example: { amountMinor: 1000n, currency: 'PLN' } → "10,00 zł" (pl)
 */
export function formatMoney(money: MinorUnitAmount, locale: SupportedLocale): string {
  const exponent = getMinorUnitExponent(money.currency);
  const formatter = new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });

  // Stay in bigint: Number(amountMinor) loses precision above 2^53 minor units.
  // Format the whole part as a bigint and splice in the exact fraction digits.
  const negative = money.amountMinor < 0n;
  const absolute = negative ? -money.amountMinor : money.amountMinor;
  const divisor = 10n ** BigInt(exponent);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(exponent, '0');
  // -0n is 0n, so a negative amount below one unit is formatted from -1n with the
  // integer digit replaced, which keeps the locale's minus sign placement.
  const sample = negative ? -(whole === 0n ? 1n : whole) : whole;

  return formatter
    .formatToParts(sample)
    .map((part) => formatPart(part, fraction, whole === 0n))
    .join('');
}

function formatPart(part: Intl.NumberFormatPart, fraction: string, zeroWhole: boolean): string {
  if (part.type === 'fraction') {
    return fraction;
  }
  if (part.type === 'integer' && zeroWhole) {
    return '0';
  }

  return part.value;
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
