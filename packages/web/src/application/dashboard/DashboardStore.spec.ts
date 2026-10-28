import { describe, it, expect, vi, beforeEach, type Mock, type MockInstance } from 'vitest';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { DashboardStore, selectDefaultPlan } from './DashboardStore.js';
import { PlanDashboardStore } from './PlanDashboardStore.js';
import { PLAN } from '../../test/dashboardFixtures.js';
import { catalogueFor } from '../../test/referenceCatalogue.js';
import { deferred } from '../../test/deferred.js';

vi.mock('../../AppProviders.js', () => ({ plansApi: {}, categoriesApi: {} }));

const personal: PlanDto = { ...PLAN, id: 'plan-personal', type: 'personal' };
const weekly: PlanDto = { ...PLAN, id: 'plan-weekly', type: 'personal', periodKind: 'weekly' };

describe('selectDefaultPlan', () => {
  it('prefers the personal monthly plan, else the first plan', () => {
    expect(selectDefaultPlan([PLAN, personal])?.id).toBe('plan-personal');
    expect(selectDefaultPlan([weekly, PLAN])?.id).toBe('plan-weekly');
    expect(selectDefaultPlan([])).toBeUndefined();
  });
});

describe('DashboardStore', () => {
  let list: Mock<() => Promise<PlanDto[]>>;
  let planDashboard: PlanDashboardStore;
  let load: MockInstance<(planId: string) => Promise<void>>;
  let store: DashboardStore;

  beforeEach(() => {
    list = vi.fn().mockResolvedValue([PLAN, personal]);
    const api = { get: vi.fn(), dashboard: vi.fn(), listItems: vi.fn(), unplanned: vi.fn() };
    planDashboard = new PlanDashboardStore(api, catalogueFor(api, { list: vi.fn() }));
    load = vi.spyOn(planDashboard, 'load').mockResolvedValue(undefined);
    store = new DashboardStore({ list }, planDashboard);
  });

  it('opens the default plan once the plans are read', async () => {
    await store.open();

    expect(store.plansLoaded).toBe(true);
    expect(store.activePlans.map((p) => p.id)).toEqual(['plan-1', 'plan-personal']);
    expect(store.selectedPlanId).toBe('plan-personal');
    expect(load).toHaveBeenCalledWith('plan-personal');
  });

  it('keeps the selected plan when the plans are read again', async () => {
    await store.open();
    store.selectPlan('plan-1');

    await store.open();

    expect(store.selectedPlanId).toBe('plan-1');
    expect(load).toHaveBeenLastCalledWith('plan-1');
  });

  it('refreshes the selected plan only', async () => {
    store.refresh();
    expect(load).not.toHaveBeenCalled();

    await store.open();
    store.refresh();

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith('plan-personal');
  });

  it('polls the dashboard of the selected plan only, without a full load', async () => {
    const poll = vi.spyOn(planDashboard, 'poll').mockResolvedValue(undefined);
    store.poll();
    expect(poll).not.toHaveBeenCalled();

    await store.open();
    load.mockClear();
    store.poll();

    expect(poll).toHaveBeenCalledOnce();
    expect(poll).toHaveBeenCalledWith('plan-personal');
    expect(load).not.toHaveBeenCalled();
  });

  it('stops the dashboard timers and drops a late plan list when the Overview is left', async () => {
    const stop = vi.spyOn(planDashboard, 'stop');
    const late = deferred<PlanDto[]>();
    list.mockReturnValue(late.promise);
    const opening = store.open();

    store.close();
    late.resolve([PLAN]);
    await opening;

    expect(stop).toHaveBeenCalledOnce();
    expect(load).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
  });

  it('flags a failed plan list and selects nothing', async () => {
    list.mockRejectedValue(new Error('down'));

    await store.open();

    expect(store.plansError).toBe(true);
    expect(store.plansLoaded).toBe(false);
    expect(store.loading).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('forgets the plans and the selection when the session ends', async () => {
    await store.open();

    store.resetSession();

    expect(store.activePlans).toEqual([]);
    expect(store.selectedPlanId).toBeNull();
    expect(store.plansLoaded).toBe(false);
    expect(store.plansError).toBe(false);
    expect(store.loading).toBe(false);
  });

  it('drops a plan list or failure that arrives after the session ended', async () => {
    const plans = deferred<PlanDto[]>();
    list.mockReturnValueOnce(plans.promise);
    const opening = store.open();
    store.resetSession();
    plans.resolve([personal]);
    await opening;

    const failed = deferred<PlanDto[]>();
    list.mockReturnValueOnce(failed.promise);
    const failing = store.open();
    store.resetSession();
    failed.reject(new Error('down'));
    await failing;

    expect(store.activePlans).toEqual([]);
    expect(store.selectedPlanId).toBeNull();
    expect(store.plansError).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
});
