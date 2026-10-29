import { describe, it, expect, vi } from 'vitest';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { CreatePlanStore, type CreatePlanApi } from './CreatePlanStore.js';
import { PLAN, apiError } from '../../test/dashboardFixtures.js';

const TODAY = new Date(2026, 9, 29);

function setup(hasHousehold: boolean, create = vi.fn<CreatePlanApi['create']>()) {
  const store = new CreatePlanStore({ create }, hasHousehold, TODAY, 'PLN');
  store.setName('October');

  return { store, create };
}

describe('CreatePlanStore', () => {
  it('offers the household type only to a household member', () => {
    expect(setup(true).store.typeOptions).toEqual(['personal', 'household']);
    expect(setup(false).store.typeOptions).toEqual(['personal']);
  });

  it('ignores the household type for a user without a household', () => {
    const { store } = setup(false);

    store.setType('household');

    expect(store.draft.type).toBe('personal');
  });

  it('defaults the base currency to the profile currency', () => {
    expect(setup(true).store.draft.baseCurrency).toBe('PLN');
  });

  it('creates a household plan for any household member', async () => {
    const created: PlanDto = { ...PLAN, type: 'household' };
    const { store, create } = setup(true, vi.fn().mockResolvedValue(created));
    store.setType('household');

    await expect(store.submit()).resolves.toBe(created);

    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: 'October',
      type: 'household',
      periodKind: 'monthly',
      periodStart: '2026-10-01',
      baseCurrency: 'PLN',
    });
  });

  it('creates a weekly plan with the end derived from the start', async () => {
    const { store, create } = setup(false, vi.fn().mockResolvedValue(PLAN));
    store.setPeriodKind('weekly');
    store.setStartDate('2026-10-26');

    expect(store.derivedEndDate).toBe('2026-11-01');
    await store.submit();

    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: 'October',
      type: 'personal',
      periodKind: 'weekly',
      periodStart: '2026-10-26',
      baseCurrency: 'PLN',
    });
  });

  it('derives the monthly end from the start and leaves the custom end empty', () => {
    const { store } = setup(false);

    expect(store.derivedEndDate).toBe('2026-10-31');

    store.setPeriodKind('custom');

    expect(store.derivedEndDate).toBe('');
  });

  it('creates a custom plan with both dates', async () => {
    const { store, create } = setup(false, vi.fn().mockResolvedValue(PLAN));
    store.setPeriodKind('custom');
    store.setStartDate('2026-10-05');
    store.setEndDate('2026-10-20');

    await store.submit();

    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: 'October',
      type: 'personal',
      periodKind: 'custom',
      periodStart: '2026-10-05',
      periodEnd: '2026-10-20',
      baseCurrency: 'PLN',
    });
  });

  it('shows field errors and does not call the API for an invalid custom period', async () => {
    const { store, create } = setup(false);
    store.setPeriodKind('custom');
    store.setEndDate('2026-09-01');

    await expect(store.submit()).resolves.toBeNull();

    expect(store.errors).toEqual({ endDate: 'not_after_start' });
    expect(create).not.toHaveBeenCalled();
  });

  it('clears a field error once the field is fixed', async () => {
    const { store } = setup(false);
    store.setName('');
    await store.submit();
    expect(store.errors).toEqual({ name: 'required' });

    store.setName('Fixed');

    expect(store.errors).toEqual({});
  });

  it('maps a 409 to the duplicate error', async () => {
    const { store } = setup(false, vi.fn().mockRejectedValue(apiError(409, 'plan_duplicate')));

    await expect(store.submit()).resolves.toBeNull();

    expect(store.submitError).toBe('duplicate');
    expect(store.submitting).toBe(false);
  });

  it('maps a 400 to invalid and any other failure to failed', async () => {
    const invalid = setup(false, vi.fn().mockRejectedValue(apiError(400, 'plan_period_invalid')));
    const failed = setup(false, vi.fn().mockRejectedValue(new Error('offline')));

    await invalid.store.submit();
    await failed.store.submit();

    expect(invalid.store.submitError).toBe('invalid');
    expect(failed.store.submitError).toBe('failed');
  });
});
