import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  BankAccountId,
  CategoryId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanId,
  PlannedItemId,
  TransactionId,
  TransactionMappingId,
  UserId,
} from '@power-budget/core';
import type { FxRateTable, Mapping, Transaction } from '@power-budget/core';
import type { Category } from '../../../domain/categories/entities.js';
import type {
  CategoryPrivacyRepository,
  CategoryRepository,
} from '../../../domain/categories/ports.js';
import type { Plan, PlannedItem } from '../../../domain/plans/entities.js';
import type {
  PlanActivityReader,
  PlannedItemRepository,
  PlanRepository,
} from '../../../domain/plans/ports.js';
import type { FxRateRepository } from '../../../domain/fx/index.js';
import { PlanFxRatesLoader } from '../../plans/plan-fx-rates.js';
import { GetHouseholdDashboardUseCase } from './GetHouseholdDashboardUseCase.js';
import { testUuid } from '../../../test/doubles/testUuid.js';

const HH = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const ANN = UserId.of('01900000-df75-7d2d-8df4-707b8b171d37');
const BOB = UserId.of('01900000-2f5d-7fe5-8e88-c03764db3083');
const PLAN = PlanId.of('01900000-9df3-7cd5-8459-d2fb1d3f0b7c');
const GROCERIES = CategoryId.of('01900000-6531-7012-80f0-ce400ebdf7c3');
const OLD = CategoryId.of('01900000-4af7-73c5-8af7-121d4d750401');
const UNUSED_OLD = CategoryId.of('01900000-d2ef-7f14-848b-c910834e1a29');
const AS_OF = new Date('2026-10-20T12:00:00Z');

function plan(overrides: Partial<Plan> = {}): Plan {
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
    createdAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    ...overrides,
  };
}

function category(id: CategoryId, overrides: Partial<Category> = {}): Category {
  return {
    id,
    householdId: null,
    seedKey: `expense.${id}`,
    name: id,
    icon: 'tag',
    color: '#000000',
    kind: 'expense',
    archivedAt: null,
    createdAt: IsoDateTime.of('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function item(id: string, categoryId: CategoryId): PlannedItem {
  return {
    id: PlannedItemId.of(testUuid(id)),
    planId: PLAN,
    householdId: HH,
    categoryId,
    direction: 'expense',
    amount: { amountMinor: 50_000n, currency: 'PLN' },
    note: null,
    matchHint: null,
    createdAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
  };
}

function tx(id: string, amountMinor: bigint, currency: 'PLN' | 'EUR' = 'PLN'): Transaction {
  return {
    id: TransactionId.of(testUuid(id)),
    householdId: HH,
    accountId: BankAccountId.of('01900000-998a-733e-8778-f641457f6a29'),
    externalId: null,
    source: 'bank',
    status: 'booked',
    amount: { amountMinor, currency },
    description: id,
    merchantName: null,
    bookedAt: IsoDate.of('2026-10-10'),
    createdAt: IsoDateTime.of('2026-10-10T00:00:00Z'),
    ignored: false,
  };
}

function mapping(txId: string, itemId: string): Mapping {
  return {
    id: TransactionMappingId.of(testUuid(txId)),
    householdId: HH,
    transactionId: TransactionId.of(testUuid(txId)),
    plannedItemId: PlannedItemId.of(testUuid(itemId)),
    createdByUserId: ANN,
    createdAt: IsoDateTime.of('2026-10-10T00:00:00Z'),
  };
}

function setup(table: FxRateTable = new Map()): {
  useCase: GetHouseholdDashboardUseCase;
  planRepo: ReturnType<typeof mock<PlanRepository>>;
} {
  const planRepo = mock<PlanRepository>();
  planRepo.findById.mockResolvedValue(plan());
  const items = mock<PlannedItemRepository>();
  items.listByPlan.mockResolvedValue([item('item-g', GROCERIES), item('item-o', OLD)]);
  const transactions = [tx('ann-1', -2_000n), tx('bob-1', -500n), tx('elsewhere', -9_999n)];
  const activity = mock<PlanActivityReader>();
  activity.read.mockResolvedValue({
    transactions,
    owners: new Map([
      [transactions[0]!.id, ANN],
      [transactions[1]!.id, BOB],
      [transactions[2]!.id, ANN],
    ]),
    // `elsewhere` is mapped to an item of another plan.
    mappings: [
      mapping('ann-1', 'item-g'),
      mapping('bob-1', 'item-g'),
      mapping('elsewhere', 'item-x'),
    ],
    transfers: [],
  });
  const categories = mock<CategoryRepository>();
  categories.list.mockResolvedValue([
    category(GROCERIES),
    category(OLD, { archivedAt: IsoDateTime.of('2026-09-01T00:00:00Z'), householdId: HH }),
    category(UNUSED_OLD, { archivedAt: IsoDateTime.of('2026-09-01T00:00:00Z') }),
  ]);
  const privacy = mock<CategoryPrivacyRepository>();
  privacy.listByHousehold.mockResolvedValue([
    {
      categoryId: GROCERIES,
      householdId: HH,
      level: 'total_with_counts',
      updatedBy: ANN,
      updatedAt: IsoDateTime.of('2026-10-01T00:00:00Z'),
    },
  ]);
  const fxRepo = mock<FxRateRepository>();
  fxRepo.getTable.mockResolvedValue(table);

  return {
    useCase: new GetHouseholdDashboardUseCase(
      planRepo,
      items,
      activity,
      categories,
      privacy,
      new PlanFxRatesLoader(fxRepo),
    ),
    planRepo,
  };
}

describe('GetHouseholdDashboardUseCase', () => {
  it('aggregates this plan per category with per-owner privacy', async () => {
    const { useCase } = setup();

    const { categories } = await useCase.execute({
      householdId: HH,
      planId: PLAN,
      viewerUserId: BOB,
      asOf: AS_OF,
    });

    expect(categories.map((c) => c.categoryId)).toEqual([GROCERIES, OLD]);
    const groceries = categories[0]!;
    expect(groceries.totalAmount).toEqual({ amountMinor: 2_500n, currency: 'PLN' });
    expect(groceries.privacyLevel).toBe('total_with_counts');
    expect(groceries.transactionCount).toBe(2);
    expect(groceries.transactions?.map((t) => t.transactionId)).toEqual([testUuid('bob-1')]);
    expect(groceries.category).toMatchObject({ isSystem: true, sortOrder: 0 });
    expect(categories[1]).toMatchObject({
      privacyLevel: 'total_only',
      totalAmount: { amountMinor: 0n, currency: 'PLN' },
      category: { isSystem: false, sortOrder: 1 },
    });
  });

  it("hides a partner's personal plan", async () => {
    const { useCase, planRepo } = setup();
    planRepo.findById.mockResolvedValue(plan({ type: 'personal', ownerUserId: ANN }));

    await expect(
      useCase.execute({ householdId: HH, planId: PLAN, viewerUserId: BOB, asOf: AS_OF }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });

  it('turns a missing FX rate into FX_RATE_UNAVAILABLE', async () => {
    const eurPlan = setup();
    eurPlan.planRepo.findById.mockResolvedValue(plan({ baseCurrency: 'EUR' }));

    await expect(
      eurPlan.useCase.execute({ householdId: HH, planId: PLAN, viewerUserId: ANN, asOf: AS_OF }),
    ).rejects.toThrow('FX_RATE_UNAVAILABLE: PLN/EUR for 2026-10-20');
  });
});
