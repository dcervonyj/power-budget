import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanId, HouseholdId, IsoDate, IsoDateTime, UserId } from '@power-budget/core';
import type { Plan } from '../../../../domain/plans/entities.js';
import type { PlanRepository } from '../../../../domain/plans/ports.js';
import { ClosePeriodSnapshotUseCase } from '../ClosePeriodSnapshotUseCase.js';
import { PeriodCloseFailedError, PeriodCloseUseCase } from '../PeriodCloseUseCase.js';

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
      list: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findDueForClose: vi.fn(),
    };
    closePeriodSnapshot = { execute: vi.fn() } as unknown as ClosePeriodSnapshotUseCase;
    useCase = new PeriodCloseUseCase(planRepo, closePeriodSnapshot);
  });

  it('closes every plan due before the job day, stamping the snapshots with the run time', async () => {
    const day = '2024-02-01' as IsoDate;
    const now = new Date('2024-02-01T00:30:00Z');
    const duePlans = [
      makePlan(PLAN_ID_1, '2024-01-31' as IsoDate),
      makePlan(PLAN_ID_2, '2024-01-15' as IsoDate),
    ];
    vi.mocked(planRepo.findDueForClose).mockResolvedValue(duePlans);
    vi.mocked(closePeriodSnapshot.execute).mockResolvedValue(undefined);

    const result = await useCase.execute(day, now);

    expect(result).toEqual({ plansProcessed: 2 });
    expect(planRepo.findDueForClose).toHaveBeenCalledWith('2024-02-01');
    expect(closePeriodSnapshot.execute).toHaveBeenNthCalledWith(1, {
      planId: PLAN_ID_1,
      householdId: HH_ID,
      closedAt: '2024-02-01T00:30:00.000Z',
    });
    expect(closePeriodSnapshot.execute).toHaveBeenNthCalledWith(2, {
      planId: PLAN_ID_2,
      householdId: HH_ID,
      closedAt: '2024-02-01T00:30:00.000Z',
    });
  });

  it('uses the job day, not the processing time, to pick the plans', async () => {
    vi.mocked(planRepo.findDueForClose).mockResolvedValue([]);

    await useCase.execute('2024-02-01' as IsoDate, new Date('2024-02-03T09:00:00Z'));

    expect(planRepo.findDueForClose).toHaveBeenCalledWith('2024-02-01');
  });

  it('returns plansProcessed 0 when no plan is due', async () => {
    vi.mocked(planRepo.findDueForClose).mockResolvedValue([]);

    const result = await useCase.execute('2024-02-01' as IsoDate, new Date('2024-02-01T00:30:00Z'));

    expect(result).toEqual({ plansProcessed: 0 });
    expect(closePeriodSnapshot.execute).not.toHaveBeenCalled();
  });

  it('closes the remaining plans, then fails the job so BullMQ retries the failed one', async () => {
    const now = new Date('2024-02-01T00:30:00Z');
    const duePlans = [
      makePlan(PLAN_ID_1, '2024-01-31' as IsoDate),
      makePlan(PLAN_ID_2, '2024-01-31' as IsoDate),
    ];
    vi.mocked(planRepo.findDueForClose).mockResolvedValue(duePlans);
    vi.mocked(closePeriodSnapshot.execute)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined);

    const failure = await useCase
      .execute('2024-02-01' as IsoDate, now)
      .catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(PeriodCloseFailedError);
    expect(failure).toMatchObject({ plansProcessed: 1 });
    expect([...(failure as PeriodCloseFailedError).failures.keys()]).toEqual([PLAN_ID_1]);
    expect((failure as PeriodCloseFailedError).message).toContain('DB error');
    expect(closePeriodSnapshot.execute).toHaveBeenCalledTimes(2);
  });
});
