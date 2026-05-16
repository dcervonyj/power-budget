import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  IsoDate,
  IsoDateTime,
  UserId,
  HouseholdId,
  PlanActualsView,
  CurrencyCode,
} from '@power-budget/core';
import { PlanId } from '@power-budget/core';
import type { Plan } from '../../domain/entities.js';
import type { PlanRepository, PlanActualsReader } from '../../domain/ports.js';
import { GetPlanDashboardUseCase } from './GetPlanDashboardUseCase.js';

const PLAN_ID = PlanId.of('01900000-0000-7000-8000-000000000001');
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

function makeMockView(): PlanActualsView {
  const zero = { amountMinor: 0n, currency: 'PLN' as CurrencyCode };
  return {
    planId: PLAN_ID,
    period: { start: '2024-01-01' as IsoDate, end: '2024-01-31' as IsoDate },
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
    asOf: '2024-01-15' as IsoDate,
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
      listActive: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      findByPeriodEnd: vi.fn(),
    };
    actualsReader = { read: vi.fn() };
    useCase = new GetPlanDashboardUseCase(planRepo, actualsReader);
  });

  it('returns the plan actuals view from the reader', async () => {
    const view = makeMockView();
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(view);

    const asOf = new Date('2024-01-15');
    const result = await useCase.execute({ planId: PLAN_ID, householdId: HH_ID, asOf });

    expect(result).toBe(view);
    expect(actualsReader.read).toHaveBeenCalledWith(PLAN_ID, asOf);
  });

  it('delegates entirely to PlanActualsReader without transforming the result', async () => {
    const view = makeMockView();
    vi.mocked(planRepo.findById).mockResolvedValue(makeMockPlan());
    vi.mocked(actualsReader.read).mockResolvedValue(view);

    const result = await useCase.execute({
      planId: PLAN_ID,
      householdId: HH_ID,
      asOf: new Date(),
    });

    expect(result).toStrictEqual(view);
  });

  it('throws PLAN_NOT_FOUND when plan is not in household', async () => {
    vi.mocked(planRepo.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ planId: PLAN_ID, householdId: HH_ID, asOf: new Date() }),
    ).rejects.toThrow('PLAN_NOT_FOUND');
  });
});
