import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IsoDate,
  IsoDateTime,
  UserId,
  HouseholdId,
  PlannedItemId,
  CategoryId,
} from '@power-budget/core';
import type { PlanActualsView, CurrencyCode } from '@power-budget/core';
import { CurrencyMismatchError, PlanId } from '@power-budget/core';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { uuidv7 } from 'uuidv7';
import type { Plan } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlanActualsReader,
  LeftoverSnapshotRepository,
} from '../../../domain/plans/ports.js';
import { ClosePeriodSnapshotUseCase } from './ClosePeriodSnapshotUseCase.js';

const PLN: CurrencyCode = 'PLN';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const HH_ID = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const USER_ID = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');
// The close job runs the day after the period ends.
const CLOSED_AT = IsoDateTime.of('2024-02-01T00:30:00.000Z');

function makeMockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN_ID,
    householdId: HH_ID,
    ownerUserId: USER_ID,
    name: 'My Plan',
    type: 'personal',
    periodKind: 'monthly',
    period: { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-31') },
    baseCurrency: 'PLN',
    archivedAt: null,
    createdAt: IsoDateTime.of('2024-01-01T00:00:00Z'),
    updatedAt: IsoDateTime.of('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeMockView(
  expenseRemaining: bigint = 2000n,
  expenseCurrency: CurrencyCode = 'PLN',
): PlanActualsView {
  const planned = { amountMinor: 5000n, currency: PLN };
  const actual = { amountMinor: 5000n - expenseRemaining, currency: PLN };
  const remaining = { amountMinor: expenseRemaining, currency: expenseCurrency };
  const zero = { amountMinor: 0n, currency: PLN };

  return {
    planId: PLAN_ID,
    period: { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-31') },
    baseCurrency: 'PLN',
    // Income that fell short of plan must never count as leftover.
    incomeLines: [
      {
        plannedItemId: PlannedItemId.of('01900000-0000-7000-8000-000000000011'),
        categoryId: CategoryId.of('01900000-e3ad-7e80-84a8-ba4337b10f34'),
        direction: 'income',
        planned: { amountMinor: 900000n, currency: 'PLN' },
        actual: { amountMinor: 100000n, currency: 'PLN' },
        remaining: { amountMinor: 800000n, currency: 'PLN' },
        progressBand: 'ok',
      },
    ],
    expenseLines: [
      {
        plannedItemId: PlannedItemId.of('01900000-0000-7000-8000-000000000010'),
        categoryId: CategoryId.of('01900000-2548-776e-8414-dc1c91b1b01c'),
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
    asOf: IsoDate.of('2024-01-31'),
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
      list: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findDueForClose: vi.fn(),
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

  it('saves the expense-only leftover under the plan period end, in the plan currency', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(makeMockView(2000n));
    vi.mocked(leftoverSnapshotRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT });

    expect(leftoverSnapshotRepo.save).toHaveBeenCalledWith({
      id: '01900000-0000-7000-8000-000000000021',
      planId: PLAN_ID,
      householdId: HH_ID,
      periodEnd: '2024-01-31',
      closedAt: CLOSED_AT,
      leftover: { amountMinor: 2000n, currency: 'PLN' },
      entries: [
        {
          snapshotId: '01900000-0000-7000-8000-000000000020',
          planId: PLAN_ID,
          plannedItemId: '01900000-0000-7000-8000-000000000010',
          categoryId: '01900000-2548-776e-8414-dc1c91b1b01c',
          plannedAmount: { amountMinor: 5000n, currency: 'PLN' },
          actualAmount: { amountMinor: 3000n, currency: 'PLN' },
          leftover: { amountMinor: 2000n, currency: 'PLN' },
          asOf: '2024-01-31',
        },
      ],
    });
  });

  it('works with real UUIDv7 ids (randomUUID v4 ids are rejected by LeftoverSnapshotId)', async () => {
    const realIds = new ClosePeriodSnapshotUseCase(
      planRepo,
      actualsReader,
      leftoverSnapshotRepo,
      uuidv7,
    );
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(makeMockView(2000n));

    await realIds.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT });

    expect(leftoverSnapshotRepo.save).toHaveBeenCalledTimes(1);
  });

  it('fails instead of guessing when a line is not in the plan currency', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(makeMockView(2000n, 'EUR'));

    await expect(
      useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT }),
    ).rejects.toBeInstanceOf(CurrencyMismatchError);
    expect(leftoverSnapshotRepo.save).not.toHaveBeenCalled();
  });

  it('fails for an unsupported plan currency (no USD fallback)', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan({ baseCurrency: 'XXX' }));

    await expect(
      useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT }),
    ).rejects.toThrow('UNSUPPORTED_CURRENCY');
    expect(leftoverSnapshotRepo.save).not.toHaveBeenCalled();
  });

  it('clamps negative remaining to zero in leftover entries', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(makeMockView(-500n));
    vi.mocked(leftoverSnapshotRepo.save).mockResolvedValue(undefined);

    await useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT });

    expect(leftoverSnapshotRepo.save).toHaveBeenCalledTimes(1);
    const entries = vi.mocked(leftoverSnapshotRepo.save).mock.calls[0]?.[0].entries ?? [];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map((entry) => entry.leftover)).toEqual(
      entries.map(() => ({ amountMinor: 0n, currency: 'PLN' })),
    );
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, householdId: HH_ID, closedAt: CLOSED_AT }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});
