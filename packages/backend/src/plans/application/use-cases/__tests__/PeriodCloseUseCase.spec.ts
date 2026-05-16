import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanId, HouseholdId, IsoDate, IsoDateTime, UserId } from '@power-budget/core';
import type { Plan } from '../../../domain/entities.js';
import type { PlanRepository } from '../../../domain/ports.js';
import type { ClosePeriodSnapshotInput } from '../ClosePeriodSnapshotUseCase.js';
import { ClosePeriodSnapshotUseCase } from '../ClosePeriodSnapshotUseCase.js';
import { PeriodCloseUseCase } from '../PeriodCloseUseCase.js';

const PLAN_ID_1 = 'plan-1' as PlanId;
const PLAN_ID_2 = 'plan-2' as PlanId;
const HH_ID = 'hh-1' as HouseholdId;

function makePlan(id: PlanId, periodEnd: IsoDate): Plan {
  return {
    id,
    householdId: HH_ID,
    ownerUserId: 'u-1' as UserId,
    name: 'Test Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01' as IsoDate, end: periodEnd },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00Z' as IsoDateTime,
    updatedAt: '2024-01-01T00:00:00Z' as IsoDateTime,
  };
}

describe('PeriodCloseUseCase', () => {
  let planRepo: PlanRepository;
  let closePeriodSnapshot: ClosePeriodSnapshotUseCase;
  let useCase: PeriodCloseUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByPeriodEnd: vi.fn(),
    };
    closePeriodSnapshot = { execute: vi.fn() } as unknown as ClosePeriodSnapshotUseCase;
    useCase = new PeriodCloseUseCase(planRepo, closePeriodSnapshot);
  });

  it('processes all plans ending yesterday', async () => {
    const now = new Date('2024-02-01T00:30:00Z');
    const yesterdayPlans = [
      makePlan(PLAN_ID_1, '2024-01-31' as IsoDate),
      makePlan(PLAN_ID_2, '2024-01-31' as IsoDate),
    ];
    vi.mocked(planRepo.findByPeriodEnd).mockResolvedValue(yesterdayPlans);
    vi.mocked(closePeriodSnapshot.execute).mockResolvedValue(undefined);

    const result = await useCase.execute(now);

    expect(result).toEqual({ plansProcessed: 2 });
    expect(planRepo.findByPeriodEnd).toHaveBeenCalledWith(
      expect.objectContaining({ toISOString: expect.any(Function) }),
    );
    const callArg = vi.mocked(planRepo.findByPeriodEnd).mock.calls[0]?.[0];
    expect(callArg?.toISOString().slice(0, 10)).toBe('2024-01-31');
    expect(closePeriodSnapshot.execute).toHaveBeenCalledTimes(2);

    const call1: ClosePeriodSnapshotInput = vi.mocked(closePeriodSnapshot.execute).mock
      .calls[0]![0];
    expect(call1.planId).toBe(PLAN_ID_1);
    expect(call1.householdId).toBe(HH_ID);
  });

  it('returns plansProcessed 0 when no plans end yesterday', async () => {
    vi.mocked(planRepo.findByPeriodEnd).mockResolvedValue([]);

    const result = await useCase.execute(new Date('2024-02-01T00:30:00Z'));

    expect(result).toEqual({ plansProcessed: 0 });
    expect(closePeriodSnapshot.execute).not.toHaveBeenCalled();
  });

  it('is idempotent — continues processing remaining plans when one fails', async () => {
    const now = new Date('2024-02-01T00:30:00Z');
    const yesterdayPlans = [
      makePlan(PLAN_ID_1, '2024-01-31' as IsoDate),
      makePlan(PLAN_ID_2, '2024-01-31' as IsoDate),
    ];
    vi.mocked(planRepo.findByPeriodEnd).mockResolvedValue(yesterdayPlans);
    vi.mocked(closePeriodSnapshot.execute)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined);

    const result = await useCase.execute(now);

    // First plan failed, second succeeded
    expect(result).toEqual({ plansProcessed: 1 });
    expect(closePeriodSnapshot.execute).toHaveBeenCalledTimes(2);
  });
});
