import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanDashboardResponseDto as PlanDashboardDto } from '@power-budget/shared-app/contract';
import { ClientSession } from '../auth/ClientSession.js';
import type { ReferenceCatalogue } from '../catalogue/ReferenceCatalogue.js';
import type { CatalogueCategories } from '../catalogue/ReferenceCatalogue.js';
import { catalogueFor } from '../../test/referenceCatalogue.js';
import { PlanDashboardStore, type PlanDashboardPlans } from './PlanDashboardStore.js';
import {
  CATEGORIES,
  DASHBOARD,
  EMPTY_PAGE,
  ITEMS,
  PLAN,
  UNPLANNED_LAST_PAGE,
  UNPLANNED_PAGE,
} from '../../test/dashboardFixtures.js';
import { deferred } from '../../test/deferred.js';

type Mocked = { [K in keyof PlanDashboardPlans]: ReturnType<typeof vi.fn> } & PlanDashboardPlans;

const NEWER: PlanDashboardDto = { ...DASHBOARD, asOf: '2026-10-22' };

describe('PlanDashboardStore polling and reference data', () => {
  let plans: Mocked;
  let categories: { list: ReturnType<typeof vi.fn> } & CatalogueCategories;
  let catalogue: ReferenceCatalogue;
  let store: PlanDashboardStore;

  function requestCount(): number {
    return (
      plans.get.mock.calls.length +
      plans.dashboard.mock.calls.length +
      plans.listItems.mock.calls.length +
      plans.unplanned.mock.calls.length +
      categories.list.mock.calls.length
    );
  }

  beforeEach(() => {
    plans = {
      get: vi.fn().mockResolvedValue(PLAN),
      dashboard: vi.fn().mockResolvedValue(DASHBOARD),
      listItems: vi.fn().mockResolvedValue(ITEMS),
      unplanned: vi
        .fn()
        .mockImplementation((_planId: string, direction: string) =>
          Promise.resolve(direction === 'expense' ? UNPLANNED_PAGE : EMPTY_PAGE),
        ),
    };
    categories = { list: vi.fn().mockResolvedValue(CATEGORIES) };
    catalogue = catalogueFor(plans, categories);
    store = new PlanDashboardStore(plans, catalogue);
  });

  it('sends one request per poll', async () => {
    await store.load('plan-1');
    const afterLoad = requestCount();

    await store.poll('plan-1');
    await store.poll('plan-1');

    expect(requestCount() - afterLoad).toBe(2);
    expect(plans.dashboard).toHaveBeenCalledTimes(3);
    expect(plans.get).toHaveBeenCalledOnce();
    expect(plans.listItems).toHaveBeenCalledOnce();
    expect(categories.list).toHaveBeenCalledOnce();
    expect(plans.unplanned).toHaveBeenCalledTimes(2);
  });

  it('shows the polled dashboard with the names from the first load', async () => {
    await store.load('plan-1');
    plans.dashboard.mockResolvedValue(NEWER);

    await store.poll('plan-1');

    expect(store.dashboard?.asOf).toBe('2026-10-22');
    expect(store.dashboard?.expense.map((g) => g.categoryName)).toEqual(['Groceries', 'Rent']);
    expect(store.loading).toBe(false);
  });

  it('keeps the pages the user loaded with "load more" across polls', async () => {
    await store.load('plan-1');
    plans.unplanned.mockResolvedValueOnce(UNPLANNED_LAST_PAGE);
    await store.loadMoreUnplanned('expense');
    const paged = store.unplannedExpenses;
    expect(paged.items.length).toBeGreaterThan(UNPLANNED_PAGE.items.length);

    await store.poll('plan-1');
    await store.poll('plan-1');

    expect(store.unplannedExpenses).toBe(paged);
  });

  it('reads the reference data once for a plan, also across loads', async () => {
    await store.load('plan-1');
    await store.load('plan-1');

    expect(plans.get).toHaveBeenCalledOnce();
    expect(plans.listItems).toHaveBeenCalledOnce();
    expect(categories.list).toHaveBeenCalledOnce();
  });

  it('reads the plan and its items again for another plan, the categories not', async () => {
    await store.load('plan-1');
    await store.load('plan-2');

    expect(plans.get.mock.calls).toEqual([['plan-1'], ['plan-2']]);
    expect(plans.listItems.mock.calls).toEqual([['plan-1'], ['plan-2']]);
    expect(categories.list).toHaveBeenCalledOnce();
  });

  it('reads the reference data again on the next load after a local change, not on a poll', async () => {
    await store.load('plan-1');
    catalogue.invalidate();
    const afterLoad = requestCount();

    await store.poll('plan-1');
    await store.poll('plan-1');
    expect(requestCount() - afterLoad).toBe(2);

    await store.load('plan-1');
    expect(plans.get).toHaveBeenCalledTimes(2);
    expect(plans.listItems).toHaveBeenCalledTimes(2);
    expect(categories.list).toHaveBeenCalledTimes(2);
  });

  it('polls with exactly one request even when the reference reads failed at load', async () => {
    plans.listItems.mockRejectedValueOnce(new Error('down'));
    categories.list.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    const afterLoad = requestCount();

    await store.poll('plan-1');
    await store.poll('plan-1');

    expect(requestCount() - afterLoad).toBe(2);
    expect(plans.dashboard).toHaveBeenCalledTimes(3);
  });

  it('starts no unplanned request for a load that a newer load replaced', async () => {
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);
    const older = store.load('plan-1');
    await store.load('plan-1');
    const unplannedAfterNewer = plans.unplanned.mock.calls.length;
    const pages = store.unplannedExpenses;

    slow.resolve({ ...DASHBOARD, asOf: '2026-10-01' });
    await older;

    expect(plans.unplanned).toHaveBeenCalledTimes(unplannedAfterNewer);
    expect(store.unplannedExpenses).toBe(pages);
    expect(store.dashboard?.asOf).toBe(DASHBOARD.asOf);
  });

  it('does a full load when there is no dashboard yet (first poll after a failure)', async () => {
    plans.dashboard.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    expect(store.error).toBe('failed');

    await store.poll('plan-1');

    expect(store.error).toBeNull();
    expect(store.dashboard).not.toBeNull();
    expect(plans.unplanned).toHaveBeenCalled();
  });

  it('keeps the shown dashboard when a poll fails, and tries again on the next', async () => {
    await store.load('plan-1');
    const shown = store.dashboard;
    plans.dashboard.mockRejectedValueOnce(new Error('down'));

    await store.poll('plan-1');

    expect(store.dashboard).toBe(shown);
    expect(store.error).toBeNull();
    plans.dashboard.mockResolvedValue(NEWER);
    await store.poll('plan-1');
    expect(store.dashboard?.asOf).toBe('2026-10-22');
  });

  it('skips a poll while the previous one is still in flight', async () => {
    await store.load('plan-1');
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);

    const first = store.poll('plan-1');
    await store.poll('plan-1');
    expect(plans.dashboard).toHaveBeenCalledTimes(2);

    slow.resolve(NEWER);
    await first;
    expect(store.dashboard?.asOf).toBe('2026-10-22');
    await store.poll('plan-1');
    expect(plans.dashboard).toHaveBeenCalledTimes(3);
  });

  it('skips a poll while a load is in flight', async () => {
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);
    const load = store.load('plan-1');

    await store.poll('plan-1');
    expect(plans.dashboard).toHaveBeenCalledOnce();

    slow.resolve(DASHBOARD);
    await load;
  });

  it('ignores a poll for a plan that is not shown', async () => {
    await store.load('plan-1');
    plans.dashboard.mockClear();

    await store.poll('plan-2');

    expect(plans.dashboard).not.toHaveBeenCalled();
  });

  it('drops the answer of a poll in flight when the plan switches', async () => {
    await store.load('plan-1');
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);
    const poll = store.poll('plan-1');

    plans.get.mockResolvedValue({ ...PLAN, id: 'plan-2', name: 'November' });
    plans.dashboard.mockResolvedValue({ ...DASHBOARD, planId: 'plan-2' });
    await store.load('plan-2');
    slow.resolve(NEWER);
    await poll;

    expect(store.planId).toBe('plan-2');
    expect(store.dashboard?.planName).toBe('November');
    expect(store.loading).toBe(false);
    // The poll that was dropped does not block the next one.
    plans.dashboard.mockClear();
    await store.poll('plan-2');
    expect(plans.dashboard).toHaveBeenCalledOnce();
  });

  it('drops the answer of a poll in flight when a reload of the same plan started after it', async () => {
    await store.load('plan-1');
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);
    const poll = store.poll('plan-1');
    plans.dashboard.mockResolvedValue({ ...DASHBOARD, asOf: '2026-10-23' });

    await store.load('plan-1');
    slow.resolve({ ...DASHBOARD, asOf: '2026-10-19' });
    await poll;

    expect(store.dashboard?.asOf).toBe('2026-10-23');
  });

  it('drops a slow older load that finishes after a newer one', async () => {
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);
    const older = store.load('plan-1');
    plans.dashboard.mockResolvedValue(NEWER);
    await store.load('plan-1');

    slow.resolve({ ...DASHBOARD, asOf: '2026-10-01' });
    await older;

    expect(store.dashboard?.asOf).toBe('2026-10-22');
  });

  it('drops the answer of a poll in flight when the session ends', async () => {
    await store.load('plan-1');
    const slow = deferred<PlanDashboardDto>();
    plans.dashboard.mockReturnValueOnce(slow.promise);
    const poll = store.poll('plan-1');

    store.resetSession();
    slow.resolve(NEWER);
    await poll;

    expect(store.dashboard).toBeNull();
    expect(store.planId).toBeNull();
  });

  it('does not add a "load more" page of an older load to the list of a newer one', async () => {
    await store.load('plan-1');
    const slow = deferred<typeof UNPLANNED_LAST_PAGE>();
    plans.unplanned.mockReturnValueOnce(slow.promise);
    const more = store.loadMoreUnplanned('expense');

    await store.load('plan-1');
    const fresh = store.unplannedExpenses;
    slow.resolve(UNPLANNED_LAST_PAGE);
    await more;

    expect(store.unplannedExpenses).toBe(fresh);
  });

  it('clears the catalogue and the dashboard when the session ends (CLN-034)', async () => {
    const session = new ClientSession();
    session.register(catalogue);
    session.register(store);
    await store.load('plan-1');

    session.end();

    expect(store.dashboard).toBeNull();
    await store.load('plan-1');
    expect(plans.get).toHaveBeenCalledTimes(2);
    expect(plans.listItems).toHaveBeenCalledTimes(2);
    expect(categories.list).toHaveBeenCalledTimes(2);
  });
});
