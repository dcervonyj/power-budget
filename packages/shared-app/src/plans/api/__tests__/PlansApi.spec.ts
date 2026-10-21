import { beforeEach, describe, expect, it } from 'vitest';
import type { PlanDto, PlannedItemDto, PlannedItemVersionDto } from '../../../contract/dto.js';
import { RecordingHttpClient } from '../../../test/RecordingHttpClient.js';
import { PlansApi, isPlanArchived } from '../PlansApi.js';

const plan: PlanDto = {
  id: 'plan-1',
  name: 'October',
  type: 'personal',
  ownerUserId: 'user-1',
  periodKind: 'monthly',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const item: PlannedItemDto = {
  id: 'item-1',
  planId: 'plan-1',
  categoryId: 'cat-1',
  direction: 'expense',
  amount: { amountMinor: '120000', currency: 'PLN' },
  note: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('PlansApi', () => {
  let http: RecordingHttpClient;
  let api: PlansApi;

  beforeEach(() => {
    http = new RecordingHttpClient();
    api = new PlansApi(http);
  });

  it('lists active plans by default and all plans on request', async () => {
    http.respondWith([plan], [plan]);

    expect(await api.list()).toEqual([plan]);
    await api.list('all');

    expect(http.calls).toEqual([
      { method: 'GET', url: '/plans?status=active' },
      { method: 'GET', url: '/plans?status=all' },
    ]);
  });

  it('creates, updates, archives and clones plans with the contract bodies', async () => {
    http.respondWith(plan, plan, plan, plan);

    await api.create({
      name: 'October',
      type: 'personal',
      periodKind: 'monthly',
      periodStart: '2026-10-01',
      baseCurrency: 'PLN',
    });
    await api.update('plan-1', { name: 'Renamed', baseCurrency: 'EUR' });
    await api.archive('plan-1');
    await api.clone('plan-1', { periodStart: '2026-11-01', periodEnd: '2026-11-30' });

    expect(http.calls).toEqual([
      {
        method: 'POST',
        url: '/plans',
        body: {
          name: 'October',
          type: 'personal',
          periodKind: 'monthly',
          periodStart: '2026-10-01',
          baseCurrency: 'PLN',
        },
      },
      { method: 'PATCH', url: '/plans/plan-1', body: { name: 'Renamed', baseCurrency: 'EUR' } },
      { method: 'POST', url: '/plans/plan-1/archive', body: {} },
      {
        method: 'POST',
        url: '/plans/plan-1/clone',
        body: { periodStart: '2026-11-01', periodEnd: '2026-11-30' },
      },
    ]);
  });

  it('reads and writes planned items and their history', async () => {
    const version: PlannedItemVersionDto = {
      id: 'v-1',
      plannedItemId: 'item-1',
      before: { amount: { amountMinor: '100000', currency: 'PLN' } },
      after: { amount: { amountMinor: '120000', currency: 'PLN' } },
      changedBy: 'user-1',
      changedAt: '2026-10-02T10:00:00.000Z',
      reason: null,
    };
    http.respondWith([item], item, item, undefined, [version]);

    expect(await api.listItems('plan-1')).toEqual([item]);
    await api.createItem('plan-1', {
      categoryId: 'cat-1',
      direction: 'expense',
      amountMinor: '120000',
      currency: 'PLN',
    });
    await api.updateItem('plan-1', 'item-1', { amountMinor: '130000', currency: 'PLN' });
    await api.deleteItem('plan-1', 'item-1');
    expect(await api.itemHistory('plan-1', 'item-1')).toEqual([version]);

    expect(http.calls).toEqual([
      { method: 'GET', url: '/plans/plan-1/items' },
      {
        method: 'POST',
        url: '/plans/plan-1/items',
        body: { categoryId: 'cat-1', direction: 'expense', amountMinor: '120000', currency: 'PLN' },
      },
      {
        method: 'PATCH',
        url: '/plans/plan-1/items/item-1',
        body: { amountMinor: '130000', currency: 'PLN' },
      },
      { method: 'DELETE', url: '/plans/plan-1/items/item-1' },
      { method: 'GET', url: '/plans/plan-1/items/item-1/history' },
    ]);
  });
});

describe('isPlanArchived', () => {
  it('is true only when archivedAt is set', () => {
    expect(isPlanArchived(plan)).toBe(false);
    expect(isPlanArchived({ ...plan, archivedAt: '2026-10-20T00:00:00.000Z' })).toBe(true);
  });
});
