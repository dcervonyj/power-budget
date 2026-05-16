import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  IsoDate,
  IsoDateTime,
  UserId,
  HouseholdId,
  PlanActualsView,
  CurrencyCode,
  PlannedItemId,
  CategoryId,
} from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../domain/entities.js';
import type {
  PlanRepository,
  PlanActualsReader,
  LeftoverSnapshotRepository,
} from '../../domain/ports.js';
import { ClosePeriodSnapshotUseCase } from './ClosePeriodSnapshotUseCase.js';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const HH_ID = 'hh-1' as HouseholdId;
const USER_ID = 'u-1' as UserId;
const CLOSED_AT = '2024-01-31T23:59:59Z' as IsoDateTime;

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

function makeMockView(expenseRemaining: bigint = 2000n): PlanActualsView {
  const planned = { amountMinor: 5000n, currency: 'PLN' as CurrencyCode };
  const actual = { amountMinor: 5000n - expenseRemaining, currency: 'PLN' as CurrencyCode };
  const remaining = { amountMinor: expenseRemaining, currency: 'PLN' as CurrencyCode };
  const zero = { amountMinor: 0n, currency: 'PLN' as CurrencyCode };

  return {
    planId: PLAN_ID,
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
    baseCurrency: 'PLN',
    incomeLines: [],
    expenseLines: [
      {
        plannedItemId: '01900000-0000-7000-8000-000000000010' as PlannedItemId,
        categoryId: 'cat-1' as CategoryId,
        direction: 'expense',
        planned,
        actual,
        remaining,
        progressBand: 'ok',
      },
    ],
    totalPlannedIncome: zero,
    totalActualIncome: zero,
    totalPlannedExpenses: planned,
    totalActualExpenses: actual,
    unplannedExpenses: zero,
    unplannedIncome: zero,
    net: zero,
    asOf: '2024-01-31' as IsoDate,
  };
}

describe('ClosePeriodSnapshotUseCase', () => {
  let planRepo: PlanRepository;
  let actualsReader: PlanActualsReader;
  let leftoverSnapshotRepo: LeftoverSnapshotRepository;
  let idSequence: string[];
  let useCase: ClosePeriodSnapshotUseCase;

  beforeEach(() => {
    planRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByPeriodEnd: vi.fn(),
    };
    actualsReader = { read: vi.fn() };
    leftoverSnapshotRepo = { save: vi.fn() };
    idSequence = ['01900000-0000-7000-8000-000000000020', '01900000-0000-7000-8000-000000000021'];
    let callCount = 0;
    const generateId = vi.fn(
      () => idSequence[callCount++] ?? '01900000-0000-7000-8000-000000000099',
    );
    useCase = new ClosePeriodSnapshotUseCase(
      planRepo,
      actualsReader,
      leftoverSnapshotRepo,
      generateId,
    );
  });

  it('saves a snapshot with leftover entries derived from the actuals view', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(makeMockView(2000n));
    vi.mocked(leftoverSnapshotRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT });

    expect(leftoverSnapshotRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: PLAN_ID,
        householdId: HH_ID,
        closedAt: CLOSED_AT,
        entries: expect.arrayContaining([
          expect.objectContaining({
            leftover: { amountMinor: 2000n, currency: 'PLN' },
          }),
        ]),
      }),
    );
  });

  it('clamps negative remaining to zero in leftover entries', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(makeMockView(-500n));
    vi.mocked(leftoverSnapshotRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT });

    expect(leftoverSnapshotRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            leftover: { amountMinor: 0n, currency: 'PLN' },
          }),
        ]),
      }),
    );
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});
