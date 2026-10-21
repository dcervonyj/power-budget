import { describe, expect, it } from 'vitest';
import { PlanMapper } from './PlanMapper.js';

describe('PlanMapper', () => {
  it('maps a CLN-011 plan to the screen shape', () => {
    expect(
      PlanMapper.toPlan({
        id: 'p1',
        name: 'October',
        type: 'personal',
        ownerUserId: 'u1',
        periodKind: 'monthly',
        period: { start: '2026-10-01', end: '2026-10-31' },
        baseCurrency: 'PLN',
        archivedAt: '2026-11-01T00:00:00.000Z',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'p1',
      name: 'October',
      period: 'monthly',
      status: 'archived',
      baseCurrency: 'PLN',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      updatedAt: '2026-10-02T00:00:00.000Z',
    });
  });

  it('adds the category name when it is known', () => {
    const item = PlanMapper.toItem(
      {
        id: 'i1',
        planId: 'p1',
        categoryId: 'c1',
        direction: 'expense',
        amount: { amountMinor: '100', currency: 'EUR' },
        note: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
      new Map([['c1', 'Groceries']]),
    );

    expect(item.categoryName).toBe('Groceries');
  });

  it('keeps planned item minor units as the exact string', () => {
    expect(
      PlanMapper.toItem({
        id: 'i1',
        planId: 'p1',
        categoryId: 'c1',
        direction: 'expense',
        amount: { amountMinor: '9007199254740993', currency: 'EUR' },
        note: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'i1',
      planId: 'p1',
      categoryId: 'c1',
      direction: 'expense',
      amountMinor: '9007199254740993',
      currency: 'EUR',
    });
  });
});
