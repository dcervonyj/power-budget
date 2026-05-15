import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId, PlannedItemId } from '@power-budget/core';
import type { Plan, PlannedItem } from '../../../domain/plans/entities.js';
import type { PlanRepository, PlannedItemRepository } from '../../../domain/plans/ports.js';
import { AddPlannedItemUseCase } from './AddPlannedItemUseCase.js';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const ITEM_ID = PlannedItemId.of('01900000-0000-7000-8000-000000000002');
const HH_ID = 'hh-1' as HouseholdId;
const USER_ID = 'u-1' as UserId;

function makeMockPlan(): Plan {
  return {
    id: PLAN_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'My Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

function makeMockItem(): PlannedItem {
  return {
    id: ITEM_ID,
    planId: PLAN_ID,
    householdId: HH_ID,
    categoryId: 'cat-1' as PlannedItem['categoryId'],
    direction: 'expense',
    amount: { amountMinor: 5000n, currency: 'PLN' },
    note: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

describe('AddPlannedItemUseCase', () => {
  let planRepo: PlanRepository;
  let plannedItemRepo: PlannedItemRepository;
  let useCase: AddPlannedItemUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
    };
    plannedItemRepo = {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      listByPlan: vi.fn(),
    };
    const generateId = vi.fn().mockReturnValue('01900000-0000-7000-8000-000000000002');
    useCase = new AddPlannedItemUseCase(planRepo, plannedItemRepo, generateId);
  });

  it('adds a planned item to the plan', async () => {
    const item = makeMockItem();
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(plannedItemRepo.add).mockResolvedValue(item);

    const result = await useCase.execute({
      planId: PLAN_ID,
      categoryId: 'cat-1' as PlannedItem['categoryId'],
      direction: 'expense',
      amount: { amountMinor: 5000n, currency: 'PLN' },
      userId: USER_ID,
      householdId: HH_ID,
    });

    expect(result).toBe(item);
    expect(plannedItemRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: PLAN_ID,
        householdId: HH_ID,
        direction: 'expense',
        amount: { amountMinor: 5000n, currency: 'PLN' },
      }),
    );
  });

  it('throws PLAN_NOT_FOUND when plan does not exist in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({
        planId: PLAN_ID,
        categoryId: 'cat-1' as PlannedItem['categoryId'],
        direction: 'expense',
        amount: { amountMinor: 5000n, currency: 'PLN' },
        userId: USER_ID,
        householdId: HH_ID,
      }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});
