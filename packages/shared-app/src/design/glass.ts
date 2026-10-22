export type DesignLocale = 'en' | 'pl' | 'uk' | 'ru';
export type ProgressBand = 'ok' | 'warning' | 'over';
import type { StatusKind } from './types.js';

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

const LOCALES: Record<DesignLocale, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
  uk: 'uk-UA',
  ru: 'ru-RU',
};

/** Remaining/planned fraction, constrained for light rendering. */
export function lightFraction(left: MoneyValue, plan: MoneyValue): number {
  if (left.currency !== plan.currency || plan.amountMinor <= 0n) {
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
export function formatMoneyParts(money: MoneyValue, locale: DesignLocale): readonly MoneyPart[] {
  const negative = money.amountMinor < 0n;
  const absolute = negative ? -money.amountMinor : money.amountMinor;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  const sample = negative ? -(whole === 0n ? 1n : whole) : whole;
  const formatter = new Intl.NumberFormat(LOCALES[locale], {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.formatToParts(sample).map((part) => ({
    type: part.type,
    value: moneyPartValue(part.type, part.value, fraction, whole === 0n, money.currency),
  }));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
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
