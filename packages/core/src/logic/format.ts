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

/** One piece of a formatted amount, shaped like `Intl.NumberFormatPart`. */
export interface MoneyPart {
  readonly type: string;
  readonly value: string;
}

const MINUS_SIGN = '\u2212';

/**
 * The one money formatter (DSN, PO decision D4): narrow currency symbol, true minus
 * U+2212, locale grouping (also for four digits) and decimal separator.
 * Exact bigint minor units, so amounts above 2^53 keep every digit.
 * Example: { amountMinor: -123456n, currency: 'PLN' } in pl → "−", "1", " ", "234", ",", "56", " ", "zł"
 */
export function formatMoneyParts(
  money: MinorUnitAmount,
  locale: SupportedLocale,
): readonly MoneyPart[] {
  const exponent = getMinorUnitExponent(money.currency);
  const formatter = new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  });
  const negative = money.amountMinor < 0n;
  const absolute = negative ? -money.amountMinor : money.amountMinor;
  const divisor = 10n ** BigInt(exponent);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(exponent, '0');
  // -0n is 0n, so a negative amount below one unit is formatted from -1n; only the
  // sign and its placement are taken from that sample.
  const sample = negative ? -(whole === 0n ? 1n : whole) : whole;
  const integerParts = groupedIntegerParts(whole, groupSeparator(formatter));
  const parts: MoneyPart[] = [];
  let includedInteger = false;

  for (const part of formatter.formatToParts(sample)) {
    if (part.type === 'integer') {
      if (!includedInteger) {
        parts.push(...integerParts);
        includedInteger = true;
      }
    } else if (part.type !== 'group') {
      parts.push({ type: part.type, value: partValue(part, fraction, money.currency) });
    }
  }

  return parts;
}

/** The money parts joined into one display string ("1 234,56 zł", "−€10.99"). */
export function formatMoney(money: MinorUnitAmount, locale: SupportedLocale): string {
  return formatMoneyParts(money, locale)
    .map((part) => part.value)
    .join('');
}

function partValue(part: Intl.NumberFormatPart, fraction: string, currency: string): string {
  if (part.type === 'fraction') {
    return fraction;
  }
  if (part.type === 'minusSign') {
    return MINUS_SIGN;
  }
  if (part.type === 'currency' && currency === 'PLN') {
    return 'zł';
  }

  return part.value;
}

function groupSeparator(formatter: Intl.NumberFormat): string {
  for (const part of formatter.formatToParts(1234567n)) {
    if (part.type === 'group') {
      return part.value;
    }
  }

  throw new Error('Currency formatter did not provide a group separator');
}

function groupedIntegerParts(whole: bigint, separator: string): MoneyPart[] {
  const digits = whole.toString();
  const firstGroupLength = digits.length % 3 || 3;
  const parts: MoneyPart[] = [{ type: 'integer', value: digits.slice(0, firstGroupLength) }];

  for (let index = firstGroupLength; index < digits.length; index += 3) {
    parts.push({ type: 'group', value: separator });
    parts.push({ type: 'integer', value: digits.slice(index, index + 3) });
  }

  return parts;
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
