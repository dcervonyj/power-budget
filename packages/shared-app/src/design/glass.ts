export type ProgressBand = 'ok' | 'warning' | 'over';
import type { DesignLocale, StatusKind } from './types.js';
export type { DesignLocale } from './types.js';

export interface MoneyValue {
  readonly amountMinor: bigint;
  readonly currency: string;
}

export interface LensGeometry {
  readonly size: string;
  readonly opacity: string;
  readonly bloomOpacity: string;
  readonly hasCore: boolean;
}

export interface RodBeam {
  readonly width: string;
  readonly hasSpark: boolean;
}

export interface Stagger {
  readonly delay: string;
  readonly flickerDelay: string;
  readonly sparkDelay: string;
}

export interface MoneyPart {
  readonly type: string;
  readonly value: string;
}

export type MoneyFormatterFactory = (
  locale: DesignLocale,
  currency: string,
  digits: number,
) => Intl.NumberFormat;

const LOCALES: Record<DesignLocale, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
  uk: 'uk-UA',
  ru: 'ru-RU',
};

/** Remaining/planned fraction, constrained for light rendering. */
export function lightFraction(left: MoneyValue, plan: MoneyValue): number {
  if (left.currency !== plan.currency) {
    throw new Error('Cannot compare money with different currencies');
  }
  if (plan.amountMinor <= 0n) {
    return 0;
  }

  return clamp(Number(left.amountMinor) / Number(plan.amountMinor));
}

/** R2.4 lens core geometry. */
export function lensGeometry(fraction: number): LensGeometry {
  const f = clamp(fraction);
  if (f <= 0) {
    return { size: '0%', opacity: '0.00', bloomOpacity: '0.00', hasCore: false };
  }

  return {
    size: `${Math.min(62, 36 + 64 * f).toFixed(0)}%`,
    opacity: (0.62 + 0.38 * f).toFixed(2),
    bloomOpacity: (0.5 + 0.5 * f).toFixed(2),
    hasCore: true,
  };
}

/** R2.4 horizontal beam data. */
export function rodBeam(fraction: number): RodBeam {
  const f = clamp(fraction);

  return { width: `${(f * 100).toFixed(1)}%`, hasSpark: f > 0 };
}

/** Position of the month-left pace mark from the left edge. */
export function paceMark(progress: number): string {
  return `${((1 - clamp(progress)) * 100).toFixed(0)}%`;
}

/** Independent entrance and loop delays for rows. */
export function stagger(index: number): Stagger {
  const safeIndex = Math.max(0, Math.floor(index));
  const loopDelay = (safeIndex * 370) % 2000;

  return {
    delay: `${safeIndex * 80}ms`,
    flickerDelay: `${loopDelay}ms`,
    sparkDelay: `${loopDelay}ms`,
  };
}

export function statusKind(progressBand: ProgressBand, paid: boolean): StatusKind {
  if (paid) {
    return 'neutral';
  }
  if (progressBand === 'over') {
    return 'over';
  }

  return 'ok';
}

/** Exact minor-unit formatter parts for AmountText. */
export function formatMoneyParts(
  money: MoneyValue,
  locale: DesignLocale,
  formatterFactory: MoneyFormatterFactory = currencyFormatter,
): readonly MoneyPart[] {
  const negative = money.amountMinor < 0n;
  const absolute = negative ? -money.amountMinor : money.amountMinor;
  const digits = currencyDigits(locale, money.currency);
  const divisor = 10n ** BigInt(digits);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(digits, '0');
  const sample = negative ? -(whole === 0n ? 1n : whole) : whole;
  const formatter = formatterFactory(locale, money.currency, digits);
  const integerParts = groupedIntegerParts(whole, groupSeparator(formatter));
  const parts: MoneyPart[] = [];
  let includedInteger = false;

  for (const part of formatter.formatToParts(sample)) {
    if (part.type === 'integer') {
      if (!includedInteger) {
        parts.push(...integerParts);
        includedInteger = true;
      }

      continue;
    }
    if (part.type === 'group') {
      continue;
    }

    parts.push({
      type: part.type,
      value: moneyPartValue(part.type, part.value, fraction, whole === 0n, money.currency),
    });
  }

  return parts;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function currencyDigits(locale: DesignLocale, currency: string): number {
  const formatter = new Intl.NumberFormat(LOCALES[locale], {
    style: 'currency',
    currency,
  });

  const digits = formatter.resolvedOptions().maximumFractionDigits;
  if (digits === undefined) {
    throw new Error('Currency formatter did not provide fractional digits');
  }

  return digits;
}

function currencyFormatter(
  locale: DesignLocale,
  currency: string,
  digits: number,
): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALES[locale], {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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

function moneyPartValue(
  type: string,
  value: string,
  fraction: string,
  zeroWhole: boolean,
  currency: string,
): string {
  if (type === 'fraction') {
    return fraction;
  }
  if (type === 'integer' && zeroWhole) {
    return '0';
  }
  if (type === 'minusSign') {
    return '−';
  }
  if (type === 'currency' && currency === 'PLN') {
    return 'zł';
  }

  return value;
}
