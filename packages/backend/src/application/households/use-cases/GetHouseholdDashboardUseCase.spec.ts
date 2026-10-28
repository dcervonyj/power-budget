import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  BankAccountId,
  CategoryId,
  FxRateTable,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  Mapping,
  PlanId,
  PlannedItemId,
  Transaction,
  TransactionId,
  TransactionMappingId,
  UserId,
} from '@power-budget/core';
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

const HH = 'hh-1' as HouseholdId;
const ANN = 'u-ann' as UserId;
const BOB = 'u-bob' as UserId;
const PLAN = 'plan-1' as PlanId;
const GROCERIES = 'cat-groceries' as CategoryId;
const OLD = 'cat-old' as CategoryId;
const UNUSED_OLD = 'cat-unused-old' as CategoryId;
const AS_OF = new Date('2026-10-20T12:00:00Z');

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN,
    householdId: HH,
    ownerUserId: null,
    name: 'October',
    type: 'household',
    periodKind: 'monthly',
    period: { start: '2026-10-01' as IsoDate, end: '2026-10-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
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
    createdAt: '2026-01-01T00:00:00Z' as IsoDateTime,
    ...overrides,
  };
}

function item(id: string, categoryId: CategoryId): PlannedItem {
  return {
    id: id as PlannedItemId,
    planId: PLAN,
    householdId: HH,
    categoryId,
    direction: 'expense',
    amount: { amountMinor: 50_000n, currency: 'PLN' },
    note: null,
    matchHint: null,
    createdAt: '2026-10-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
  };
}

function tx(id: string, amountMinor: bigint, currency: 'PLN' | 'EUR' = 'PLN'): Transaction {
  return {
    id: id as TransactionId,
    householdId: HH,
    accountId: 'acc-1' as BankAccountId,
    externalId: null,
    source: 'bank',
    status: 'booked',
    amount: { amountMinor, currency },
    description: id,
    merchantName: null,
    bookedAt: '2026-10-10' as IsoDate,
    createdAt: '2026-10-10T00:00:00Z' as IsoDateTime,
    ignored: false,
  };
}

function mapping(txId: string, itemId: string): Mapping {
  return {
    id: txId as TransactionMappingId,
    householdId: HH,
    transactionId: txId as TransactionId,
    plannedItemId: itemId as PlannedItemId,
    createdByUserId: ANN,
    createdAt: '2026-10-10T00:00:00Z' as IsoDateTime,
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
    category(OLD, { archivedAt: '2026-09-01T00:00:00Z' as IsoDateTime, householdId: HH }),
    category(UNUSED_OLD, { archivedAt: '2026-09-01T00:00:00Z' as IsoDateTime }),
  ]);
  const privacy = mock<CategoryPrivacyRepository>();
  privacy.listByHousehold.mockResolvedValue([
    {
      categoryId: GROCERIES,
      householdId: HH,
      level: 'total_with_counts',
      updatedBy: ANN,
      updatedAt: '2026-10-01T00:00:00Z' as IsoDateTime,
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
    expect(groceries.transactions?.map((t) => t.transactionId)).toEqual(['bob-1']);
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
