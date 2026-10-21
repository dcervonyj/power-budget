import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { DashboardStore, selectDefaultPlan } from './DashboardStore.js';
import { PlanDashboardStore } from './PlanDashboardStore.js';
import { PLAN } from '../../test/dashboardFixtures.js';

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
  let list: ReturnType<typeof vi.fn>;
  let planDashboard: PlanDashboardStore;
  let load: MockInstance<(planId: string) => Promise<void>>;
  let store: DashboardStore;

  beforeEach(() => {
    list = vi.fn().mockResolvedValue([PLAN, personal]);
    planDashboard = new PlanDashboardStore(
      { get: vi.fn(), dashboard: vi.fn(), listItems: vi.fn(), unplanned: vi.fn() },
      { list: vi.fn() },
    );
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

  it('flags a failed plan list and selects nothing', async () => {
    list.mockRejectedValue(new Error('down'));

    await store.open();

    expect(store.plansError).toBe(true);
    expect(store.plansLoaded).toBe(false);
    expect(store.loading).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
});
