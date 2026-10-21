import { describe, expect, it } from 'vitest';
import type { PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';
import { loadPlannedItems, suggestedFirst } from './PlannedItemLabels.js';

function plan(id: string, name: string): PlanDto {
  return {
    id,
    name,
    type: 'personal',
    ownerUserId: 'u1',
    periodKind: 'monthly',
    period: { start: '2026-10-01', end: '2026-10-31' },
    baseCurrency: 'EUR',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function item(id: string, planId: string, categoryId: string): PlannedItemDto {
  return {
    id,
    planId,
    categoryId,
    direction: 'expense',
    amount: { amountMinor: '100', currency: 'EUR' },
    note: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('loadPlannedItems', () => {
  it('lists the items of every active plan with plan and category names', async () => {
    const catalogue = await loadPlannedItems(
      {
        list: () => Promise.resolve([plan('p1', 'May'), plan('p2', 'June')]),
        listItems: (id: string) =>
          Promise.resolve(id === 'p1' ? [item('i1', 'p1', 'c1')] : [item('i2', 'p2', 'c2')]),
      },
      () =>
        Promise.resolve(
          new Map([
            ['c1', 'Groceries'],
            ['c2', 'Transport'],
          ]),
        ),
    );

    expect(catalogue.options.map((o) => [o.item.id, o.planName, o.categoryName])).toEqual([
      ['i1', 'May', 'Groceries'],
      ['i2', 'June', 'Transport'],
    ]);
    expect(catalogue.labels.get('i2')).toEqual({ planName: 'June', categoryName: 'Transport' });
  });
});

describe('suggestedFirst', () => {
  const options = ['a', 'b', 'c'].map((id) => ({
    item: item(id, 'p', 'c'),
    planName: 'P',
    categoryName: id,
  }));

  it('moves the API-suggested item to the top and keeps the rest in order', () => {
    expect(suggestedFirst(options, 'c').map((o) => o.item.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the order without a suggestion', () => {
    expect(suggestedFirst(options, null).map((o) => o.item.id)).toEqual(['a', 'b', 'c']);
  });
});
