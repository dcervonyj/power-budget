import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanDashboardStore, type PlanDashboardPlans } from './PlanDashboardStore.js';
import type { CatalogueCategories } from '../catalogue/ReferenceCatalogue.js';
import { catalogueFor } from '../../test/referenceCatalogue.js';
import {
  CATEGORIES,
  D7_CATEGORIES,
  D7_DASHBOARD,
  D7_PLAN,
  DASHBOARD,
  EMPTY_PAGE,
  ITEMS,
  PLAN,
  UNPLANNED_LAST_PAGE,
  UNPLANNED_PAGE,
  apiError,
} from '../../test/dashboardFixtures.js';

function plnMoney(amountMinor: bigint): { amountMinor: bigint; currency: string } {
  return { amountMinor, currency: 'PLN' };
}

describe('PlanDashboardStore', () => {
  let plans: { [K in keyof PlanDashboardPlans]: ReturnType<typeof vi.fn> } & PlanDashboardPlans;
  let categories: { list: ReturnType<typeof vi.fn> } & CatalogueCategories;
  let store: PlanDashboardStore;

  beforeEach(() => {
    const get = vi.fn().mockResolvedValue(PLAN);
    const dashboard = vi.fn().mockResolvedValue(DASHBOARD);
    const listItems = vi.fn().mockResolvedValue(ITEMS);
    const unplanned = vi
      .fn()
      .mockImplementation((_planId: string, direction: string) =>
        Promise.resolve(direction === 'expense' ? UNPLANNED_PAGE : EMPTY_PAGE),
      );
    plans = { get, dashboard, listItems, unplanned };
    categories = { list: vi.fn().mockResolvedValue(CATEGORIES) };
    store = new PlanDashboardStore(plans, catalogueFor(plans, categories));
  });

  it('groups the lines by category, with names, sums and bands', async () => {
    await store.load('plan-1');

    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    const dashboard = store.dashboard;
    expect(dashboard?.planName).toBe('October');
    expect(dashboard?.planType).toBe('household');
    expect(dashboard?.asOf).toBe('2026-10-21');
    expect(dashboard?.income.map((g) => [g.categoryName, g.band])).toEqual([['Salary', 'over']]);
    expect(dashboard?.expense.map((g) => g.categoryName)).toEqual(['Groceries', 'Rent']);
    const groceries = dashboard?.expense[0];
    expect(groceries?.planned).toEqual(plnMoney(193000n));
    expect(groceries?.actual).toEqual(plnMoney(140000n));
    expect(groceries?.remaining).toEqual(plnMoney(53000n));
    expect(groceries?.band).toBe('ok');
    expect(groceries?.lines.map((l) => [l.plannedItemId, l.note, l.original])).toEqual([
      ['item-food', 'Weekly shop', null],
      ['item-food-eur', '', { amountMinor: 10000n, currency: 'EUR' }],
    ]);
    expect(dashboard?.expense[1]?.remaining).toEqual(plnMoney(-20000n));
    expect(dashboard?.totals.net).toEqual(plnMoney(527450n));
    expect(dashboard?.totals.unplannedExpenses).toEqual(plnMoney(12550n));
    expect(categories.list).toHaveBeenCalledWith({ includeArchived: true });
  });

  it('loads the first page of own unplanned transactions per direction and pages on', async () => {
    plans.unplanned.mockImplementation(
      (_planId: string, direction: string, cursor: string | null) =>
        Promise.resolve(
          direction === 'income'
            ? EMPTY_PAGE
            : cursor === null
              ? UNPLANNED_PAGE
              : UNPLANNED_LAST_PAGE,
        ),
    );

    await store.load('plan-1');

    expect(plans.unplanned).toHaveBeenCalledWith('plan-1', 'expense', null);
    expect(plans.unplanned).toHaveBeenCalledWith('plan-1', 'income', null);
    expect(store.unplannedExpenses.items).toEqual([
      {
        id: 'tx-1',
        description: 'Allegro',
        amount: { amountMinor: -12550n, currency: 'PLN' },
        occurredOn: '2026-10-12',
      },
    ]);
    expect(store.unplannedExpenses.nextCursor).toBe('cursor-2');
    expect(store.unplannedIncome.items).toEqual([]);

    await store.loadMoreUnplanned('expense');

    expect(plans.unplanned).toHaveBeenLastCalledWith('plan-1', 'expense', 'cursor-2');
    expect(store.unplannedExpenses.items.map((tx) => tx.amount)).toEqual([
      { amountMinor: -12550n, currency: 'PLN' },
      { amountMinor: -1240n, currency: 'EUR' },
    ]);
    expect(store.unplannedExpenses.nextCursor).toBeNull();

    await store.loadMoreUnplanned('expense');
    expect(plans.unplanned).toHaveBeenCalledTimes(3);
  });

  it('marks a failed unplanned page and reads it again on retry', async () => {
    plans.unplanned.mockRejectedValueOnce(new Error('offline'));

    await store.load('plan-1');

    const failed = store.unplannedOf('expense');
    expect(failed.failed).toBe(true);
    expect(store.dashboard).not.toBeNull();

    await store.loadMoreUnplanned('expense');

    expect(store.unplannedExpenses.failed).toBe(false);
    expect(store.unplannedExpenses.items.map((tx) => tx.id)).toEqual(['tx-1']);
  });

  it('flags a 503 fx_rate_unavailable', async () => {
    plans.dashboard.mockRejectedValue(apiError(503, 'fx_rate_unavailable'));

    await store.load('plan-1');

    expect(store.error).toBe('fx_unavailable');
    expect(store.dashboard).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('tells a missing plan from other failures', async () => {
    plans.get.mockRejectedValue(apiError(404, 'not_found'));
    await store.load('plan-1');
    expect(store.error).toBe('not_found');

    plans.get.mockRejectedValue(apiError(500));
    await store.load('plan-1');
    expect(store.error).toBe('failed');
  });

  it('still renders without categories or items', async () => {
    categories.list.mockRejectedValue(new Error('down'));
    plans.listItems.mockRejectedValue(new Error('down'));

    await store.load('plan-1');

    expect(store.dashboard?.expense.map((g) => g.categoryName)).toEqual(['', '']);
    expect(store.dashboard?.expense[0]?.lines.map((l) => l.original)).toEqual([null, null]);
  });

  it('keeps the shown dashboard during a reload and drops a late answer for another plan', async () => {
    await store.load('plan-1');
    const shown = store.dashboard;

    let release: (value: unknown) => void = () => undefined;
    plans.dashboard.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const reload = store.load('plan-1');
    expect(store.loading).toBe(true);
    expect(store.dashboard).toBe(shown);

    const other = store.load('plan-2');
    expect(store.dashboard).toBeNull();
    release({ ...DASHBOARD, planId: 'plan-1' });
    await Promise.all([reload, other]);

    expect(store.planId).toBe('plan-2');
    expect(plans.dashboard).toHaveBeenLastCalledWith('plan-2');
  });

  it('forgets the shown dashboard when the session ends and drops its late answer', async () => {
    await store.load('plan-1');
    expect(store.dashboard).not.toBeNull();

    const late = store.load('plan-1');
    store.resetSession();
    await late;

    expect(store.planId).toBeNull();
    expect(store.dashboard).toBeNull();
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.unplannedExpenses.items).toEqual([]);
    expect(store.unplannedIncome.items).toEqual([]);
  });

  it('computes safe to spend, pace and forecast from the loaded dashboard', async () => {
    expect(store.overview).toBeNull();
    plans.get.mockResolvedValue(D7_PLAN);
    plans.dashboard.mockResolvedValue(D7_DASHBOARD);
    categories.list.mockResolvedValue(D7_CATEGORIES);

    await store.load('plan-d7');

    const overview = store.overview;
    expect(overview?.spent).toEqual(plnMoney(703000n));
    expect(overview?.left).toEqual(plnMoney(477000n));
    expect(overview?.timing).toEqual({
      kind: 'current',
      today: '2026-10-22',
      day: 22,
      totalDays: 31,
      safeToSpend: { perDay: plnMoney(47700n), daysLeft: 10, isOver: false },
      pace: {
        kind: 'under',
        monthLeftFraction: 1 - 22 / 31,
        elapsedFraction: 22 / 31,
        leftPercent: 40,
        monthLeftPercent: 29,
      },
      forecast: { total: plnMoney(990600n), versusPlan: plnMoney(189400n) },
    });
    expect([...(overview?.categoryForecasts ?? new Map()).entries()]).toEqual([
      ['d7-eating-out', plnMoney(79300n)],
    ]);
  });

  it('forgets the overview with the session', async () => {
    await store.load('plan-1');
    expect(store.overview).not.toBeNull();

    store.resetSession();

    expect(store.overview).toBeNull();
  });
});
