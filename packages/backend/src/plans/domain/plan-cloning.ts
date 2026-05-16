import type { IsoDate } from '@power-budget/core';
import type { Plan, NewPlan, PlanPeriod, PlanPeriodKind } from './entities.js';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

/**
 * Computes the next contiguous period for a plan.
 * Per ARCHITECTURE.md §5.4 open question 1: next contiguous period by default.
 */
function nextPeriod(periodKind: PlanPeriodKind, current: PlanPeriod): PlanPeriod {
  const end = parseIsoDate(current.end);
  const nextStart = addDays(end, 1);

  switch (periodKind) {
    case 'weekly': {
      const nextEnd = addDays(nextStart, 6);
      return { start: toIsoDate(nextStart) as IsoDate, end: toIsoDate(nextEnd) as IsoDate };
    }
    case 'monthly': {
      const nextEnd = addDays(addMonths(nextStart, 1), -1);
      return { start: toIsoDate(nextStart) as IsoDate, end: toIsoDate(nextEnd) as IsoDate };
    }
    case 'custom': {
      const start = parseIsoDate(current.start);
      const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const nextEnd = addDays(nextStart, durationDays);
      return { start: toIsoDate(nextStart) as IsoDate, end: toIsoDate(nextEnd) as IsoDate };
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
   * Enforce the MVP invariant: ≤1 active plan of each (type, periodKind)
   * per user/household at a time — except 'custom' which has no such limit.
   */
  static assertNoDuplicateActivePlan(
    activePlans: Plan[],
    candidate: Pick<Plan, 'type' | 'periodKind'>,
  ): void {
    if (candidate.periodKind === 'custom') return; // custom is exempt

    const conflict = activePlans.find(
      (p) => p.type === candidate.type && p.periodKind === candidate.periodKind,
    );

    if (conflict) {
      throw new Error(
        `PLAN_DUPLICATE: An active ${candidate.type} ${candidate.periodKind} plan already exists (id=${conflict.id}). Archive it before creating another.`,
      );
    }
  }
}
