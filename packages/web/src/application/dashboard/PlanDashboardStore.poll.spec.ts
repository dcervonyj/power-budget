import { createMock, type DeepMocked } from '@golevelup/ts-vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const NEWER: PlanDashboardDto = { ...DASHBOARD, asOf: '2026-10-22' };

const REFRESH_DEBOUNCE = 250;
const REFRESH_RETRY = 1000;
const LOAD_RETRY = 2000;

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
}

describe('PlanDashboardStore polling and reference data', () => {
  let plans: DeepMocked<PlanDashboardPlans>;
  let categories: DeepMocked<CatalogueCategories>;
  let catalogue: ReferenceCatalogue;
  let store: PlanDashboardStore;

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Dashboard and reference requests; the unplanned lists are counted by their own tests. */
  function requestCount(): number {
    return (
      plans.get.mock.calls.length +
      plans.dashboard.mock.calls.length +
      plans.listItems.mock.calls.length +
      categories.list.mock.calls.length
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    plans = createMock<PlanDashboardPlans>({
      get: vi.fn().mockResolvedValue(PLAN),
      dashboard: vi.fn().mockResolvedValue(DASHBOARD),
      listItems: vi.fn().mockResolvedValue(ITEMS),
      unplanned: vi
        .fn()
        .mockImplementation((_planId: string, direction: string) =>
          Promise.resolve(direction === 'expense' ? UNPLANNED_PAGE : EMPTY_PAGE),
        ),
    });
    categories = createMock<CatalogueCategories>({ list: vi.fn().mockResolvedValue(CATEGORIES) });
    catalogue = catalogueFor(plans, categories);
    store = new PlanDashboardStore(plans, catalogue);
  });

  it('sends one dashboard request per poll for a list the user paged, nothing for the reference data', async () => {
    await store.load('plan-1');
    plans.unplanned.mockResolvedValueOnce(UNPLANNED_LAST_PAGE);
    await store.loadMoreUnplanned('expense');
    plans.unplanned.mockClear();

    await store.poll('plan-1');
    await store.poll('plan-1');

    expect(plans.dashboard).toHaveBeenCalledTimes(3);
    expect(plans.unplanned.mock.calls).toEqual([
      ['plan-1', 'income', null],
      ['plan-1', 'income', null],
    ]);
    expect(plans.get).toHaveBeenCalledOnce();
    expect(plans.listItems).toHaveBeenCalledOnce();
    expect(categories.list).toHaveBeenCalledOnce();
  });

  it('reconciles the first unplanned page on a poll while the list was not paged', async () => {
    await store.load('plan-1');
    plans.unplanned.mockImplementation((_planId: string, direction: string) =>
      Promise.resolve(direction === 'expense' ? UNPLANNED_LAST_PAGE : EMPTY_PAGE),
    );

    await store.poll('plan-1');

    expect(store.unplannedExpenses.items.map((t) => t.id)).toEqual(
      UNPLANNED_LAST_PAGE.items.map((t) => t.id),
    );
    expect(plans.unplanned).toHaveBeenLastCalledWith('plan-1', 'income', null);
    expect(plans.get).toHaveBeenCalledOnce();
    expect(categories.list).toHaveBeenCalledOnce();
  });

  it('keeps the list when the unplanned reconcile of a poll fails', async () => {
    await store.load('plan-1');
    const before = store.unplannedExpenses;
    plans.unplanned.mockRejectedValue(new Error('down'));

    await store.poll('plan-1');

    expect(store.unplannedExpenses).toBe(before);
  });

  it('drops a reconciled page that arrives after the user paged', async () => {
    await store.load('plan-1');
    const late = deferred<typeof UNPLANNED_PAGE>();
    plans.unplanned.mockReturnValueOnce(late.promise);
    const polling = store.poll('plan-1');
    await advance(0);
    plans.unplanned.mockResolvedValue(UNPLANNED_LAST_PAGE);
    await store.loadMoreUnplanned('expense');
    const paged = store.unplannedExpenses;
    late.resolve(UNPLANNED_PAGE);
    await polling;

    expect(store.unplannedExpenses).toBe(paged);
  });

  it('starts no timer after stop, and a failed load in flight does not retry', async () => {
    plans.dashboard.mockRejectedValue(new Error('down'));
    const loading = store.load('plan-1');
    store.stop();
    await loading;
    plans.dashboard.mockResolvedValue(DASHBOARD);

    await advance(LOAD_RETRY * 4);

    expect(plans.dashboard).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels a pending load retry and reference refresh on stop, and loads again after a new load', async () => {
    plans.dashboard.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    expect(vi.getTimerCount()).toBe(1);

    store.stop();
    await advance(LOAD_RETRY * 4);

    expect(plans.dashboard).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    await store.load('plan-1');
    catalogue.invalidate();
    expect(vi.getTimerCount()).toBe(1);
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

  it('after a local change a tick sends exactly one request; the reference refresh runs on its own timer, no reload', async () => {
    await store.load('plan-1');
    catalogue.invalidate();
    plans.dashboard.mockClear();
    plans.unplanned.mockClear();
    const before = requestCount();

    await store.poll('plan-1');
    expect(requestCount() - before).toBe(1);
    expect(plans.dashboard).toHaveBeenCalledOnce();
    plans.unplanned.mockClear();

    await advance(REFRESH_DEBOUNCE);
    expect(plans.get).toHaveBeenCalledTimes(2);
    expect(plans.listItems).toHaveBeenCalledTimes(2);
    expect(categories.list).toHaveBeenCalledTimes(2);
    expect(plans.dashboard).toHaveBeenCalledOnce();
    expect(plans.unplanned).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);

    const afterRefresh = requestCount();
    await store.poll('plan-1');
    expect(requestCount() - afterRefresh).toBe(1);
  });

  it('refreshes right after a local change even with no tick, once for a burst', async () => {
    await store.load('plan-1');
    plans.get.mockClear();

    catalogue.invalidate();
    catalogue.invalidate();
    catalogue.invalidate();
    await advance(REFRESH_DEBOUNCE);

    expect(plans.get).toHaveBeenCalledOnce();
  });

  it('shows names after a refresh replaced the fallback of a failed read, retried on its own timer', async () => {
    categories.list.mockRejectedValueOnce(new Error('down'));
    plans.listItems.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    expect(store.dashboard?.expense.map((g) => g.categoryName)).not.toEqual(['Groceries', 'Rent']);
    plans.dashboard.mockClear();

    await store.poll('plan-1');
    expect(plans.dashboard).toHaveBeenCalledOnce();
    expect(categories.list).toHaveBeenCalledTimes(1);

    await advance(REFRESH_RETRY);

    expect(store.dashboard?.expense.map((g) => g.categoryName)).toEqual(['Groceries', 'Rent']);
    categories.list.mockClear();
    await advance(120_000);
    expect(categories.list).not.toHaveBeenCalled();
  });

  it('keeps polling with one request when a plan read fails in a refresh and retries with backoff', async () => {
    await store.load('plan-1');
    catalogue.invalidate();
    plans.get.mockRejectedValue(new Error('down'));
    plans.dashboard.mockClear();
    plans.get.mockClear();

    await advance(REFRESH_DEBOUNCE);
    expect(plans.get).toHaveBeenCalledTimes(1);
    const before = requestCount();
    await store.poll('plan-1');
    expect(requestCount() - before).toBe(1);

    await advance(REFRESH_RETRY);
    expect(plans.get).toHaveBeenCalledTimes(2);
    await advance(REFRESH_RETRY);
    expect(plans.get).toHaveBeenCalledTimes(2);
    plans.get.mockResolvedValue({ ...PLAN, name: 'Renamed' });
    await advance(REFRESH_RETRY);

    expect(plans.get).toHaveBeenCalledTimes(3);
    expect(store.dashboard?.planName).toBe('Renamed');
    expect(store.error).toBeNull();
  });

  it('starts no second reference refresh while one is in flight', async () => {
    await store.load('plan-1');
    catalogue.invalidate();
    const slow = deferred<typeof PLAN>();
    plans.get.mockReturnValueOnce(slow.promise);
    plans.get.mockClear();
    await advance(REFRESH_DEBOUNCE);

    catalogue.invalidate();
    await advance(REFRESH_DEBOUNCE * 4);
    expect(plans.get).toHaveBeenCalledOnce();

    slow.resolve(PLAN);
    await advance(REFRESH_DEBOUNCE);
    // The change that came during the read gets its own refresh afterwards.
    expect(plans.get).toHaveBeenCalledTimes(2);
  });

  it('drops a reference refresh answer when the plan switched meanwhile', async () => {
    await store.load('plan-1');
    catalogue.invalidate();
    const slow = deferred<typeof PLAN>();
    plans.get.mockReturnValueOnce(slow.promise);
    await advance(REFRESH_DEBOUNCE);
    plans.get.mockResolvedValue({ ...PLAN, id: 'plan-2', name: 'November' });
    plans.dashboard.mockResolvedValue({ ...DASHBOARD, planId: 'plan-2' });
    await store.load('plan-2');

    slow.resolve({ ...PLAN, name: 'Old' });
    await advance(REFRESH_DEBOUNCE);

    expect(store.dashboard?.planName).toBe('November');
  });

  it('stops the reference timer when the session ends', async () => {
    await store.load('plan-1');
    catalogue.invalidate();
    plans.get.mockClear();

    store.resetSession();
    await advance(60_000);

    expect(plans.get).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a failed first load by its own timer, not by a tick, and shows the data', async () => {
    plans.dashboard.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    expect(store.error).toBe('failed');
    plans.dashboard.mockClear();
    plans.get.mockClear();

    const before = requestCount();
    await store.poll('plan-1');
    await store.poll('plan-1');
    expect(requestCount() - before).toBe(0);

    await advance(LOAD_RETRY);

    expect(store.error).toBeNull();
    expect(store.dashboard).not.toBeNull();
    expect(plans.dashboard).toHaveBeenCalledOnce();
    expect(plans.unplanned).toHaveBeenCalled();
  });

  it('backs off longer after each failed retry', async () => {
    plans.dashboard.mockRejectedValue(new Error('down'));
    await store.load('plan-1');
    plans.dashboard.mockClear();

    await advance(LOAD_RETRY);
    expect(plans.dashboard).toHaveBeenCalledTimes(1);
    await advance(LOAD_RETRY);
    expect(plans.dashboard).toHaveBeenCalledTimes(1);
    await advance(LOAD_RETRY);
    expect(plans.dashboard).toHaveBeenCalledTimes(2);
  });

  it('waits while the tab is hidden and retries when it is visible again', async () => {
    plans.dashboard.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    plans.dashboard.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });

    await advance(LOAD_RETRY * 3);
    expect(plans.dashboard).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    await advance(LOAD_RETRY);
    expect(plans.dashboard).toHaveBeenCalledOnce();
    expect(store.dashboard).not.toBeNull();
  });

  it('stops retrying when the plan switched or the session ended', async () => {
    plans.dashboard.mockRejectedValueOnce(new Error('down'));
    await store.load('plan-1');
    plans.dashboard.mockClear();

    store.resetSession();
    await advance(LOAD_RETRY * 10);

    expect(plans.dashboard).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing on a tick when no load was ever started or it did not fail', async () => {
    await store.poll('plan-1');

    expect(plans.dashboard).not.toHaveBeenCalled();
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
