import {
  CategoryId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanId,
  PlannedItemId,
  UserId,
} from '@power-budget/core';
import type { Plan, PlannedItem } from '../../domain/plans/entities.js';
import type { Category } from '../../domain/categories/entities.js';

export const HH = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');
export const OTHER_HH = HouseholdId.of('01900000-0000-7000-8000-0000000000a2');
export const USER = UserId.of('01900000-0000-7000-8000-0000000000b1');
export const PARTNER = UserId.of('01900000-0000-7000-8000-0000000000b2');
export const PLAN = PlanId.of('01900000-0000-7000-8000-0000000000c1');
export const OTHER_PLAN = PlanId.of('01900000-0000-7000-8000-0000000000c2');
export const ITEM = PlannedItemId.of('01900000-0000-7000-8000-0000000000d1');
export const CATEGORY = CategoryId.of('550e8400-e29b-41d4-a716-446655440000');
export const NEW_ID = '01900000-0000-7000-8000-0000000000e1';
export const NOW = new Date('2026-10-21T10:00:00.000Z');

export function makePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN,
    householdId: HH,
    ownerUserId: null,
    name: 'October',
    type: 'household',
    periodKind: 'monthly',
    period: { start: IsoDate.of('2026-10-01'), end: IsoDate.of('2026-10-31') },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00.000Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function makeItem(overrides: Partial<PlannedItem> = {}): PlannedItem {
  return {
    id: ITEM,
    planId: PLAN,
    householdId: HH,
    categoryId: CATEGORY,
    direction: 'expense',
    amount: { amountMinor: 150000n, currency: 'PLN' },
    note: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00.000Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: CATEGORY,
    householdId: HH,
    seedKey: null,
    name: 'Coffee',
    icon: 'tag',
    color: '#6B7280',
    kind: 'expense',
    archivedAt: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}
