import { describe, expect, it } from 'vitest';
import type {
  DashboardCategoryGroup,
  PlanDashboard,
} from '../../domain/dashboard/PlanDashboard.js';
import { isPaid, toDashboardOverview } from './dashboardOverview.js';

function pln(amountMinor: bigint): { amountMinor: bigint; currency: string } {
  return { amountMinor, currency: 'PLN' };
}

function group(
  categoryId: string,
  plannedMinor: bigint,
  actualMinor: bigint,
): DashboardCategoryGroup {
  return {
    categoryId,
    categoryName: categoryId,
    direction: 'expense',
    planned: pln(plannedMinor),
    actual: pln(actualMinor),
    remaining: pln(plannedMinor - actualMinor),
    band: actualMinor >= plannedMinor ? 'over' : 'ok',
    lines: [],
  };
}

/** October: planned 11 800, 6 605 mapped + 425 unplanned spent. */
function october(asOf: string, overrides: Partial<PlanDashboard['totals']> = {}): PlanDashboard {
  return {
    planId: 'plan-d7',
    planName: 'October',
    planType: 'household',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    baseCurrency: 'PLN',
    asOf,
    income: [],
    expense: [
      group('rent', 340000n, 340000n),
      group('eating-out', 50000n, 56250n),
      group('home', 90000n, 4000n),
    ],
    totals: {
      plannedIncome: pln(1420000n),
      actualIncome: pln(1300000n),
      plannedExpenses: pln(1180000n),
      actualExpenses: pln(660500n),
      unplannedIncome: pln(0n),
      unplannedExpenses: pln(42500n),
      net: pln(597000n),
      ...overrides,
    },
  };
}

describe('toDashboardOverview', () => {
  it('spreads what is left over the days left, today included (spec: 4 770 / 10 = 477)', () => {
    const overview = toDashboardOverview(october('2026-10-22'));

    expect(overview.left).toEqual(pln(477000n));
    expect(overview.leftFraction).toBeCloseTo(0.404, 3);
    expect(overview.hasPlan).toBe(true);
    expect(overview.timing.kind).toBe('current');
    if (overview.timing.kind === 'current') {
      expect(overview.timing.safeToSpend).toEqual({
        perDay: pln(47700n),
        daysLeft: 10,
        isOver: false,
      });
      expect(overview.timing.pace.monthLeftPercent).toBe(29);
      expect(overview.timing.forecast.total).toEqual(pln(990600n));
    }
  });

  it('gives the whole remainder on the last day of the period', () => {
    const overview = toDashboardOverview(october('2026-10-31'));

    expect(overview.timing).toMatchObject({
      kind: 'current',
      day: 31,
      safeToSpend: { perDay: pln(477000n), daysLeft: 1, isOver: false },
      pace: { kind: 'under', monthLeftPercent: 0 },
      forecast: { total: pln(703000n), versusPlan: pln(477000n) },
    });
  });

  it('is over with nothing a day once spending passes the plan', () => {
    const overview = toDashboardOverview(october('2026-10-22', { actualExpenses: pln(1200000n) }));

    expect(overview.left).toEqual(pln(-62500n));
    expect(overview.leftFraction).toBe(0);
    expect(overview.timing).toMatchObject({
      safeToSpend: { perDay: pln(0n), daysLeft: 10, isOver: true },
      pace: { kind: 'over', leftPercent: 0 },
    });
  });

  it('is over pace when less light is left than month', () => {
    const overview = toDashboardOverview(october('2026-10-05'));

    expect(overview.timing).toMatchObject({
      pace: { kind: 'over', leftPercent: 40, monthLeftPercent: 84 },
    });
  });

  it('has no safe to spend, pace or forecast outside the period', () => {
    expect(toDashboardOverview(october('2026-09-30')).timing).toEqual({ kind: 'future' });
    expect(toDashboardOverview(october('2026-11-01')).timing).toEqual({ kind: 'past' });
    expect(toDashboardOverview(october('2026-11-01')).categoryForecasts.size).toBe(0);
  });

  it('forecasts per category only when it ends above its plan and is not paid', () => {
    const overview = toDashboardOverview(october('2026-10-22'));

    expect([...overview.categoryForecasts.entries()]).toEqual([['eating-out', pln(79300n)]]);
  });

  it('marks a plan without planned expenses', () => {
    const overview = toDashboardOverview(
      october('2026-10-22', {
        plannedExpenses: pln(0n),
        actualExpenses: pln(0n),
        unplannedExpenses: pln(0n),
      }),
    );

    expect(overview.hasPlan).toBe(false);
    expect(overview.leftFraction).toBe(0);
  });
});

describe('isPaid', () => {
  it('is a category that spent exactly its plan', () => {
    expect(isPaid(group('rent', 340000n, 340000n))).toBe(true);
    expect(isPaid(group('home', 90000n, 4000n))).toBe(false);
    expect(isPaid(group('empty', 0n, 0n))).toBe(false);
    expect(isPaid(group('nothing-yet', 10000n, 0n))).toBe(false);
  });
});
