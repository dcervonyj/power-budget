export type ProgressBand = 'ok' | 'warning' | 'over';
import type { MinorUnitAmount } from '@power-budget/core';
import type { StatusKind } from './types.js';
export type { DesignLocale } from './types.js';

export type MoneyValue = MinorUnitAmount;

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

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}
