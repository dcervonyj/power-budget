import { DateRange, IsoDate } from '@power-budget/core';
import type { Plan, NewPlan, PlanPeriod, PlanPeriodKind } from './entities.js';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Moves to the month `months` ahead, landing on `anchorDay` or on the last day of
 * that month when it is shorter (31 Jan + 1 month = 28/29 Feb, never 2/3 Mar).
 */
function addMonthsClamped(date: Date, months: number, anchorDay: number): Date {
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, Math.min(anchorDay, lastDay)),
  );
}

/**
 * The day of month a monthly period is anchored on. A period that started on a clamped
 * day (28 Feb after a 31 Jan anchor) still ends the day before the real anchor, so the
 * larger of the start day and the next-period start day is the anchor.
 */
function monthlyAnchorDay(start: Date, end: Date): number {
  return Math.max(start.getUTCDate(), addDays(end, 1).getUTCDate());
}

function toIsoDate(d: Date): IsoDate {
  return IsoDate.of(d.toISOString().slice(0, 10));
}

function parseIsoDate(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

/**
 * Computes the next contiguous period for a plan.
 * Per ARCHITECTURE.md §5.4 open question 1: next contiguous period by default.
 */
function periodStartingOn(periodKind: 'weekly' | 'monthly', start: IsoDate): PlanPeriod {
  const startDate = parseIsoDate(start);
  const end =
    periodKind === 'weekly'
      ? addDays(startDate, 6)
      : addDays(addMonthsClamped(startDate, 1, startDate.getUTCDate()), -1);

  return { start, end: toIsoDate(end) };
}

function nextPeriod(periodKind: PlanPeriodKind, current: PlanPeriod): PlanPeriod {
  const end = parseIsoDate(current.end);
  const nextStart = addDays(end, 1);

  switch (periodKind) {
    case 'weekly': {
      const nextEnd = addDays(nextStart, 6);
      return { start: toIsoDate(nextStart), end: toIsoDate(nextEnd) };
    }
    case 'monthly': {
      const anchorDay = monthlyAnchorDay(parseIsoDate(current.start), end);
      const nextEnd = addDays(addMonthsClamped(nextStart, 1, anchorDay), -1);
      return { start: toIsoDate(nextStart), end: toIsoDate(nextEnd) };
    }
    case 'custom': {
      const start = parseIsoDate(current.start);
      const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const nextEnd = addDays(nextStart, durationDays);
      return { start: toIsoDate(nextStart), end: toIsoDate(nextEnd) };
    }
  }
}

/**
 * Domain service for plan cloning.
 * Clones structure (category + amounts) into a fresh period.
 * The caller is responsible for supplying a new PlanId and
 * for copying the PlannedItems.
 */
export class PlanCloning {
  /**
   * Compute the new plan's period when cloning from an existing plan.
   * Returns the next contiguous period unless overrideEnd is supplied.
   */
  static computeClonePeriod(
    source: Pick<Plan, 'periodKind' | 'period'>,
    overridePeriod?: PlanPeriod,
  ): PlanPeriod {
    return overridePeriod ?? nextPeriod(source.periodKind, source.period);
  }

  /**
   * Build the NewPlan object for the clone.
   */
  static buildClone(source: Plan, newId: Plan['id'], overridePeriod?: PlanPeriod): NewPlan {
    const period = PlanCloning.computeClonePeriod(source, overridePeriod);
    return {
      id: newId,
      householdId: source.householdId,
      ownerUserId: source.ownerUserId,
      name: source.name,
      type: source.type,
      periodKind: source.periodKind,
      period,
      baseCurrency: source.baseCurrency,
    };
  }

  /**
   * Enforce the MVP invariant: ≤1 non-archived plan of each (type, periodKind)
   * per owner (personal) or household (household) for any overlapping period,
   * except 'custom' which has no such limit. `existing` are the plans visible to
   * the owner; the candidate's own id (on update) is ignored.
   */
  static assertNoDuplicateActivePlan(existing: Plan[], candidate: PlanCandidate): void {
    if (candidate.periodKind === 'custom') return; // custom is exempt

    const conflict = existing.find(
      (p) =>
        p.id !== candidate.id &&
        p.archivedAt === null &&
        p.type === candidate.type &&
        p.periodKind === candidate.periodKind &&
        (candidate.type === 'household' || p.ownerUserId === candidate.ownerUserId) &&
        DateRange.overlaps(p.period, candidate.period),
    );

    if (conflict) {
      throw new Error(
        `PLAN_DUPLICATE: An active ${candidate.type} ${candidate.periodKind} plan already overlaps this period (id=${conflict.id}). Archive it before creating another.`,
      );
    }
  }
}

export interface PlanCandidate {
  readonly id?: Plan['id'];
  readonly type: Plan['type'];
  readonly periodKind: PlanPeriodKind;
  readonly period: PlanPeriod;
  readonly ownerUserId: Plan['ownerUserId'];
}

/** Period rules for creating or moving a plan. */
export const PlanPeriods = {
  /**
   * Weekly and monthly plans derive the end from the start when it is omitted;
   * custom plans need an explicit end. Throws PLAN_PERIOD_INVALID.
   */
  resolve(periodKind: PlanPeriodKind, start: IsoDate, end?: IsoDate): PlanPeriod {
    if (end === undefined) {
      if (periodKind === 'custom') {
        throw new Error('PLAN_PERIOD_INVALID: A custom plan needs an end date');
      }

      return periodStartingOn(periodKind, start);
    }
    if (end < start) {
      throw new Error('PLAN_PERIOD_INVALID: The end date is before the start date');
    }

    return { start, end };
  },
};
