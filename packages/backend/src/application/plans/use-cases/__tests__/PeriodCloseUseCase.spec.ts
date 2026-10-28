import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanId, HouseholdId, IsoDate, IsoDateTime, UserId } from '@power-budget/core';
import type { Plan } from '../../../../domain/plans/entities.js';
import type { PlanRepository } from '../../../../domain/plans/ports.js';
import { ClosePeriodSnapshotUseCase } from '../ClosePeriodSnapshotUseCase.js';
import { PeriodCloseFailedError, PeriodCloseUseCase } from '../PeriodCloseUseCase.js';

const PLAN_ID_1 = PlanId.of('01900000-9df3-7cd5-8459-d2fb1d3f0b7c');
const PLAN_ID_2 = PlanId.of('01900000-1e38-78c5-8214-74c7d1dc7342');
const HH_ID = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');

function makePlan(id: PlanId, periodEnd: IsoDate): Plan {
  return {
    id,
    householdId: HH_ID,
    ownerUserId: UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768'),
    name: 'Test Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: IsoDate.of('2024-01-01'), end: periodEnd },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: IsoDateTime.of('2024-01-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2024-01-01T00:00:00Z'),
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
    const day = IsoDate.of('2024-02-01');
    const now = new Date('2024-02-01T00:30:00Z');
    const duePlans = [
      makePlan(PLAN_ID_1, IsoDate.of('2024-01-31')),
      makePlan(PLAN_ID_2, IsoDate.of('2024-01-15')),
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

    await useCase.execute(IsoDate.of('2024-02-01'), new Date('2024-02-03T09:00:00Z'));

    expect(planRepo.findDueForClose).toHaveBeenCalledWith('2024-02-01');
  });

  it('returns plansProcessed 0 when no plan is due', async () => {
    vi.mocked(planRepo.findDueForClose).mockResolvedValue([]);

    const result = await useCase.execute(
      IsoDate.of('2024-02-01'),
      new Date('2024-02-01T00:30:00Z'),
    );

    expect(result).toEqual({ plansProcessed: 0 });
    expect(closePeriodSnapshot.execute).not.toHaveBeenCalled();
  });

  it('closes the remaining plans, then fails the job so BullMQ retries the failed one', async () => {
    const now = new Date('2024-02-01T00:30:00Z');
    const duePlans = [
      makePlan(PLAN_ID_1, IsoDate.of('2024-01-31')),
      makePlan(PLAN_ID_2, IsoDate.of('2024-01-31')),
    ];
    vi.mocked(planRepo.findDueForClose).mockResolvedValue(duePlans);
    vi.mocked(closePeriodSnapshot.execute)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined);

    const failure = await useCase
      .execute(IsoDate.of('2024-02-01'), now)
      .catch((err: unknown) => err);

    expect(failure).toBeInstanceOf(PeriodCloseFailedError);
    expect(failure).toMatchObject({ plansProcessed: 1 });
    expect([...(failure as PeriodCloseFailedError).failures.keys()]).toEqual([PLAN_ID_1]);
    expect((failure as PeriodCloseFailedError).message).toContain('DB error');
    expect(closePeriodSnapshot.execute).toHaveBeenCalledTimes(2);
  });
});
