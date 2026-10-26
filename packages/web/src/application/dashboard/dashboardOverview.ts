import {
  IsoDate,
  dailyAllowance,
  getMinorUnitExponent,
  linearForecast,
  periodProgress,
  type PeriodProgress,
} from '@power-budget/core';
import { lightFraction } from '@power-budget/shared-app';
import type {
  DashboardCategoryGroup,
  MoneyAmount,
  PlanDashboard,
} from '../../domain/dashboard/PlanDashboard.js';

/** Safe to spend today (Q4): what is left of the expense plan over the days left, today included. */
export interface SafeToSpend {
  readonly perDay: MoneyAmount;
  readonly daysLeft: number;
  /** Nothing is left: the plan's expenses (incl. unplanned) are at or past the plan. */
  readonly isOver: boolean;
}

/** Money left against the calendar: light past the mark is under pace. */
export interface Pace {
  readonly kind: 'under' | 'over';
  /** Share of the month still to come, 0..1 (the rod's mark). */
  readonly monthLeftFraction: number;
  /** Share of the month gone, 0..1. */
  readonly elapsedFraction: number;
  readonly leftPercent: number;
  readonly monthLeftPercent: number;
}

/** Linear "at this pace" projection of the period's spending (Q3), in whole currency units. */
export interface Forecast {
  readonly total: MoneyAmount;
  /** Plan minus forecast: positive closes under plan, negative over. */
  readonly versusPlan: MoneyAmount;
}

/** Day `day` of `totalDays`; the period runs today. */
export interface CurrentTiming {
  readonly kind: 'current';
  readonly today: string;
  readonly day: number;
  readonly totalDays: number;
  readonly safeToSpend: SafeToSpend;
  readonly pace: Pace;
  readonly forecast: Forecast;
}

export interface OutsideTiming {
  readonly kind: 'future' | 'past';
}

/** Where today falls in the plan period; the lens, pace and forecast exist only for the current one. */
export type OverviewTiming = CurrentTiming | OutsideTiming;

/** The figures of the Overview hero, derived from one plan dashboard. */
export interface DashboardOverview {
  readonly planned: MoneyAmount;
  /** Mapped plus unplanned expenses. */
  readonly spent: MoneyAmount;
  /** Planned minus spent; negative when over the plan. */
  readonly left: MoneyAmount;
  /** Left / planned, 0..1: the length of the light. */
  readonly leftFraction: number;
  readonly hasPlan: boolean;
  readonly timing: OverviewTiming;
  /** Per expense category: forecast at this pace when it ends above the plan (current period). */
  readonly categoryForecasts: ReadonlyMap<string, MoneyAmount>;
}

/**
 * Safe to spend, pace and forecast from the dashboard totals (core maths, exact minor units).
 * "Today" is the dashboard's `asOf`, so the figures match the actuals they come from.
 */
export function toDashboardOverview(dashboard: PlanDashboard): DashboardOverview {
  const { totals } = dashboard;
  const currency = totals.plannedExpenses.currency;
  const planned = totals.plannedExpenses;
  const spent = money(
    totals.actualExpenses.amountMinor + totals.unplannedExpenses.amountMinor,
    currency,
  );
  const left = money(planned.amountMinor - spent.amountMinor, currency);
  const progress = periodProgress(
    {
      kind: 'custom',
      range: { start: IsoDate.of(dashboard.periodStart), end: IsoDate.of(dashboard.periodEnd) },
    },
    IsoDate.of(dashboard.asOf),
  );
  const leftFraction = lightFraction(left, planned);

  return {
    planned,
    spent,
    left,
    leftFraction,
    hasPlan: planned.amountMinor > 0n,
    timing: toTiming(progress, dashboard.asOf, planned, spent, left, leftFraction),
    categoryForecasts: toCategoryForecasts(dashboard.expense, progress),
  };
}

/** A category that spent exactly its plan is paid (rent, a bill): no light, a "Paid" tag. */
export function isPaid(group: DashboardCategoryGroup): boolean {
  return (
    group.remaining.amountMinor === 0n &&
    group.planned.amountMinor > 0n &&
    group.actual.amountMinor > 0n
  );
}

function toTiming(
  progress: PeriodProgress,
  today: string,
  planned: MoneyAmount,
  spent: MoneyAmount,
  left: MoneyAmount,
  leftFraction: number,
): OverviewTiming {
  if (progress.state !== 'current') {
    return { kind: progress.state };
  }
  const allowance = dailyAllowance(left.amountMinor, progress.daysLeft);
  const total = roundToWholeUnits(
    linearForecast(spent.amountMinor, progress.elapsedFraction),
    spent.currency,
  );
  const monthLeftFraction = 1 - progress.elapsedFraction;

  return {
    kind: 'current',
    today,
    day: progress.totalDays - progress.daysLeft + 1,
    totalDays: progress.totalDays,
    safeToSpend: {
      perDay: money(allowance.amount, left.currency),
      daysLeft: progress.daysLeft,
      isOver: allowance.isOver,
    },
    pace: {
      kind: left.amountMinor > 0n && leftFraction >= monthLeftFraction ? 'under' : 'over',
      monthLeftFraction,
      elapsedFraction: progress.elapsedFraction,
      leftPercent: Math.round(leftFraction * 100),
      monthLeftPercent: Math.round(monthLeftFraction * 100),
    },
    forecast: {
      total: money(total, spent.currency),
      versusPlan: money(planned.amountMinor - total, spent.currency),
    },
  };
}

function toCategoryForecasts(
  groups: readonly DashboardCategoryGroup[],
  progress: PeriodProgress,
): ReadonlyMap<string, MoneyAmount> {
  const forecasts = new Map<string, MoneyAmount>();
  if (progress.state !== 'current') {
    return forecasts;
  }
  for (const group of groups) {
    const forecast = roundToWholeUnits(
      linearForecast(group.actual.amountMinor, progress.elapsedFraction),
      group.actual.currency,
    );
    if (!isPaid(group) && forecast > group.planned.amountMinor) {
      forecasts.set(group.categoryId, money(forecast, group.actual.currency));
    }
  }

  return forecasts;
}

/** A forecast is approximate: whole units (half away from zero), no false precision. */
function roundToWholeUnits(amountMinor: bigint, currency: string): bigint {
  const unit = 10n ** BigInt(getMinorUnitExponent(currency));
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const rounded = ((absolute + unit / 2n) / unit) * unit;

  return amountMinor < 0n ? -rounded : rounded;
}

function money(amountMinor: bigint, currency: string): MoneyAmount {
  return { amountMinor, currency };
}
