import {
  IsoDate,
  dailyAllowance,
  getMinorUnitExponent,
  linearForecast,
  parseMinorUnits,
  periodProgress,
  type MinorUnitAmount,
  type PeriodProgress,
} from '@power-budget/core';
import { lightFraction, type CategoryRowData } from '@power-budget/shared-app';
import type {
  MoneyDto,
  PlanDashboardResponseDto,
  PlannedItemActualsDto,
} from '@power-budget/shared-app/contract';

/** Safe to spend today (Q4): what is left of the expense plan over the days left, today included. */
export interface SafeToSpend {
  readonly perDay: MinorUnitAmount;
  readonly daysLeft: number;
  /** Nothing is left: the plan's expenses (incl. unplanned) are at or past the plan. */
  readonly isOver: boolean;
}

/** Money left against the calendar: light past the mark is under pace. */
export interface Pace {
  readonly kind: 'under' | 'over';
  /** Share of the period still to come, 0..1 (the rod's mark). */
  readonly monthLeftFraction: number;
  /** Rounded percentages for the texts. */
  readonly spentPercent: number;
  readonly elapsedPercent: number;
  readonly leftPercent: number;
  readonly monthLeftPercent: number;
}

/** Linear "at this pace" projection of the period's spending (Q3), in whole currency units. */
export interface Forecast {
  readonly total: MinorUnitAmount;
  /** Plan minus forecast: positive closes under plan, negative over. */
  readonly versusPlan: MinorUnitAmount;
}

/** Today is inside the plan period: day `day` of `totalDays`. */
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

/** The lens, pace and forecast exist only for the current period (Q4). */
export type OverviewTiming = CurrentTiming | OutsideTiming;

/** Everything the Overview shows for one plan, derived from `GET /plans/:id/dashboard`. */
export interface OverviewModel {
  readonly planId: string;
  readonly planName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly planned: MinorUnitAmount;
  /** Mapped plus unplanned expenses. */
  readonly spent: MinorUnitAmount;
  /** Planned minus spent; negative when over the plan. */
  readonly left: MinorUnitAmount;
  /** Left / planned, 0..1: the length of the light. */
  readonly leftFraction: number;
  readonly hasPlan: boolean;
  /** Income received (mapped plus unplanned) against the planned income. */
  readonly incomeReceived: MinorUnitAmount;
  readonly incomePlanned: MinorUnitAmount;
  readonly unplannedExpenses: MinorUnitAmount;
  /** Expense categories, over-plan first, then in the plan's order. */
  readonly categories: readonly CategoryRowData[];
  readonly timing: OverviewTiming;
}

/**
 * Safe to spend, pace and forecast from the dashboard totals (core maths, exact minor units).
 * "Today" is the dashboard's `asOf`, so the figures match the actuals they come from. Same rules
 * as the web Overview (DSN-020).
 */
export function toOverviewModel(
  dto: PlanDashboardResponseDto,
  planName: string,
  categoryNames: ReadonlyMap<string, string>,
): OverviewModel {
  const planned = toMoney(dto.totalPlannedExpenses);
  const actual = toMoney(dto.totalActualExpenses);
  const unplannedExpenses = toMoney(dto.unplannedExpenses);
  const spent = money(actual.amountMinor + unplannedExpenses.amountMinor, planned.currency);
  const left = money(planned.amountMinor - spent.amountMinor, planned.currency);
  const leftFraction = lightFraction(left, planned);
  const progress = periodProgress(
    {
      kind: 'custom',
      range: { start: IsoDate.of(dto.period.start), end: IsoDate.of(dto.period.end) },
    },
    IsoDate.of(dto.asOf),
  );

  return {
    planId: dto.planId,
    planName,
    periodStart: dto.period.start,
    periodEnd: dto.period.end,
    planned,
    spent,
    left,
    leftFraction,
    hasPlan: planned.amountMinor > 0n,
    incomeReceived: money(
      parseMinorUnits(dto.totalActualIncome.amountMinor) +
        parseMinorUnits(dto.unplannedIncome.amountMinor),
      dto.totalActualIncome.currency,
    ),
    incomePlanned: toMoney(dto.totalPlannedIncome),
    unplannedExpenses,
    categories: toCategories(dto.expenseLines, categoryNames, progress),
    timing: toTiming(progress, dto.asOf, planned, spent, left, leftFraction),
  };
}

/** A category that spent exactly its plan is paid (rent, a bill): no light, a "Paid" tag. */
export function isPaid(planned: bigint, actual: bigint): boolean {
  return planned > 0n && actual === planned;
}

function toTiming(
  progress: PeriodProgress,
  today: string,
  planned: MinorUnitAmount,
  spent: MinorUnitAmount,
  left: MinorUnitAmount,
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
  const spentFraction = planned.amountMinor > 0n ? 1 - leftFraction : 0;

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
      spentPercent: Math.round(spentFraction * 100),
      elapsedPercent: Math.round(progress.elapsedFraction * 100),
      leftPercent: Math.round(leftFraction * 100),
      monthLeftPercent: Math.round(monthLeftFraction * 100),
    },
    forecast: {
      total: money(total, spent.currency),
      versusPlan: money(planned.amountMinor - total, spent.currency),
    },
  };
}

interface CategorySums {
  readonly categoryId: string;
  readonly currency: string;
  planned: bigint;
  actual: bigint;
}

function toCategories(
  lines: readonly PlannedItemActualsDto[],
  categoryNames: ReadonlyMap<string, string>,
  progress: PeriodProgress,
): CategoryRowData[] {
  const rows = groupByCategory(lines).map((sums) => toCategoryRow(sums, categoryNames, progress));

  return [...rows.filter(isOver), ...rows.filter(isNotOver)];
}

function groupByCategory(lines: readonly PlannedItemActualsDto[]): CategorySums[] {
  const groups = new Map<string, CategorySums>();
  for (const line of lines) {
    const group = groups.get(line.categoryId) ?? {
      categoryId: line.categoryId,
      currency: line.planned.currency,
      planned: 0n,
      actual: 0n,
    };
    group.planned += parseMinorUnits(line.planned.amountMinor);
    group.actual += parseMinorUnits(line.actual.amountMinor);
    groups.set(line.categoryId, group);
  }

  return [...groups.values()];
}

function toCategoryRow(
  sums: CategorySums,
  categoryNames: ReadonlyMap<string, string>,
  progress: PeriodProgress,
): CategoryRowData {
  const paid = isPaid(sums.planned, sums.actual);
  const forecast = categoryForecast(sums, paid, progress);

  return {
    id: sums.categoryId,
    label: categoryNames.get(sums.categoryId) ?? '',
    spentMinor: sums.actual,
    plannedMinor: sums.planned,
    currency: sums.currency,
    status: statusOf(sums, paid),
    paid,
    ...(forecast === null ? {} : { forecastMinor: forecast }),
  };
}

function statusOf(sums: CategorySums, paid: boolean): CategoryRowData['status'] {
  if (paid) {
    return 'neutral';
  }

  return sums.actual > sums.planned ? 'over' : 'ok';
}

/** Forecast at this pace, only when it ends above the plan (current period, not paid). */
function categoryForecast(
  sums: CategorySums,
  paid: boolean,
  progress: PeriodProgress,
): bigint | null {
  if (progress.state !== 'current' || paid) {
    return null;
  }
  const forecast = roundToWholeUnits(
    linearForecast(sums.actual, progress.elapsedFraction),
    sums.currency,
  );

  return forecast > sums.planned ? forecast : null;
}

function isOver(row: CategoryRowData): boolean {
  return row.status === 'over';
}

function isNotOver(row: CategoryRowData): boolean {
  return row.status !== 'over';
}

/** A forecast is approximate: whole units (half away from zero), no false precision. */
export function roundToWholeUnits(amountMinor: bigint, currency: string): bigint {
  const unit = 10n ** BigInt(getMinorUnitExponent(currency));
  const absolute = amountMinor < 0n ? -amountMinor : amountMinor;
  const rounded = ((absolute + unit / 2n) / unit) * unit;

  return amountMinor < 0n ? -rounded : rounded;
}

function toMoney(dto: MoneyDto): MinorUnitAmount {
  return money(parseMinorUnits(dto.amountMinor), dto.currency);
}

function money(amountMinor: bigint, currency: string): MinorUnitAmount {
  return { amountMinor, currency };
}
