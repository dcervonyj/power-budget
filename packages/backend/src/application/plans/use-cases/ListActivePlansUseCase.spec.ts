import { describe, it, expect, vi } from 'vitest';
import type { UserId, HouseholdId, IsoDate, IsoDateTime } from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository } from '../../../domain/plans/ports.js';
import { ListActivePlansUseCase } from './ListActivePlansUseCase.js';

const HH_ID = 'hh-1' as HouseholdId;
const USER_ID = 'u-1' as UserId;

function makePlanRepo(): PlanRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    listActive: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    findByPeriodEnd: vi.fn(),
  };
}

function makePlan(): Plan {
  return {
    id: PlanId.of('01900000-0000-7000-8000-000000000001'),
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'Active Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

describe('ListActivePlansUseCase', () => {
  it('returns active plans for the user and household', async () => {
    const planRepo = makePlanRepo();
    const plans = [makePlan()];
    vi.mocked(planRepo.listActive).mockResolvedValue(plans);

    const useCase = new ListActivePlansUseCase(planRepo);
    const date = new Date('2024-01-15');
    const result = await useCase.execute({ userId: USER_ID, householdId: HH_ID, date });

    expect(result).toBe(plans);
    expect(planRepo.listActive).toHaveBeenCalledWith({
      userId: USER_ID,
      householdId: HH_ID,
      date,
    });
  });

  it('returns empty array when no active plans exist', async () => {
    const planRepo = makePlanRepo();
    vi.mocked(planRepo.listActive).mockResolvedValue([]);

    const useCase = new ListActivePlansUseCase(planRepo);
    const result = await useCase.execute({ userId: USER_ID, householdId: HH_ID, date: new Date() });

    expect(result).toEqual([]);
  });
});
