import type { PlanPeriod } from '../domain/plans/period.js';
import type { IsoDate } from '../domain/shared/ids.js';
import { planPeriodToDateRange } from './counted-transactions.js';

export type PeriodState = 'future' | 'current' | 'past';

export interface PeriodProgress {
  readonly state: PeriodState;
  readonly elapsedFraction: number;
  readonly daysLeft: number;
  readonly totalDays: number;
}

const DAY_MS = 86_400_000;

/** Calendar progress for a plan period. `daysLeft` includes `today` when current. */
export function periodProgress(period: PlanPeriod, today: IsoDate): PeriodProgress {
  const range = planPeriodToDateRange(period);
  const totalDays = daysBetween(range.start, range.end) + 1;

  if (today < range.start) {
    return { state: 'future', elapsedFraction: 0, daysLeft: 0, totalDays };
  }
  if (today > range.end) {
    return { state: 'past', elapsedFraction: 1, daysLeft: 0, totalDays };
  }

  const elapsedDays = daysBetween(range.start, today) + 1;

  return {
    state: 'current',
    elapsedFraction: elapsedDays / totalDays,
    daysLeft: totalDays - elapsedDays + 1,
    totalDays,
  };
}

function daysBetween(start: IsoDate, end: IsoDate): number {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);

  return Math.round((endMs - startMs) / DAY_MS);
}
