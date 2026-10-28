import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IsoDate, IsoDateTime, UserId, HouseholdId } from '@power-budget/core';
import type { PlanActualsView, CurrencyCode } from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, PlanActualsReader } from '../../../domain/plans/ports.js';
import { GetPlanDashboardUseCase } from './GetPlanDashboardUseCase.js';

const PLN: CurrencyCode = 'PLN';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
const HH_ID = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const USER_ID = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');

function makeMockPlan(): Plan {
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
  };
}

function makeMockView(): PlanActualsView {
  const zero = { amountMinor: 0n, currency: PLN };

  return {
    planId: PLAN_ID,
    period: { start: IsoDate.of('2024-01-01'), end: IsoDate.of('2024-01-31') },
    baseCurrency: 'PLN',
    incomeLines: [],
    expenseLines: [],
    totalPlannedIncome: zero,
    totalActualIncome: zero,
    totalPlannedExpenses: zero,
    totalActualExpenses: zero,
    unplannedExpenses: zero,
    unplannedIncome: zero,
    net: zero,
    asOf: IsoDate.of('2024-01-15'),
  };
}

describe('GetPlanDashboardUseCase', () => {
  let planRepo: PlanRepository;
  let actualsReader: PlanActualsReader;
  let useCase: GetPlanDashboardUseCase;

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
    useCase = new GetPlanDashboardUseCase(planRepo, actualsReader);
  });

  it('returns the plan actuals view from the reader', async () => {
    const view = makeMockView();
    const plan = makeMockPlan();
    vi.mocked(planRepo.findById).mockResolvedValue(plan);
    vi.mocked(actualsReader.read).mockResolvedValue(view);

    const asOf = new Date('2024-01-15');
    const result = await useCase.execute({
      planId: PLAN_ID,
      householdId: HH_ID,
      userId: USER_ID,
      asOf,
    });

    expect(result).toBe(view);
    expect(actualsReader.read).toHaveBeenCalledWith(plan, asOf);
  });

  it('delegates entirely to PlanActualsReader without transforming the result', async () => {
    const view = makeMockView();
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(view);

    const result = await useCase.execute({
      planId: PLAN_ID,
      householdId: HH_ID,
      userId: USER_ID,
      asOf: new Date(),
    });

    expect(result).toStrictEqual(view);
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, householdId: HH_ID, userId: USER_ID, asOf: new Date() }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });

  it("throws PLAN_NOT_FOUND for a partner's personal plan", async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());

    await expect(
      useCase.execute({
        planId: PLAN_ID,
        householdId: HH_ID,
        userId: UserId.of('01900000-4ba1-7ee8-8b62-c49b7e753e6b'),
        asOf: new Date(),
      }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
    expect(actualsReader.read).not.toHaveBeenCalled();
  });
});
