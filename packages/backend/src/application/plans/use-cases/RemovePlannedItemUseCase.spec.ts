import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import { PlanId, PlannedItemId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, PlannedItemRepository } from '../../../domain/plans/ports.js';
import { RemovePlannedItemUseCase } from './RemovePlannedItemUseCase.js';

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

describe('RemovePlannedItemUseCase', () => {
  let planRepo: PlanRepository;
  let plannedItemRepo: PlannedItemRepository;
  let useCase: RemovePlannedItemUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByPeriodEnd: vi.fn(),
    };
    plannedItemRepo = {
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      listByPlan: vi.fn(),
    };
    useCase = new RemovePlannedItemUseCase(planRepo, plannedItemRepo);
  });

  it('removes the planned item after scope check', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(plannedItemRepo.remove).mockResolvedValue(undefined);

    await useCase.execute({ planId: PLAN_ID, itemId: ITEM_ID, householdId: HH_ID });

    expect(plannedItemRepo.remove).toHaveBeenCalledWith(ITEM_ID);
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, itemId: ITEM_ID, householdId: HH_ID }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});
