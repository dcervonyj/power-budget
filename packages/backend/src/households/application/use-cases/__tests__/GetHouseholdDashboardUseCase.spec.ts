import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { PlanId, HouseholdId, UserId } from '@power-budget/core';
import type {
  PlanRepository,
  HouseholdDashboardReader,
  HouseholdDashboardData,
} from '../../../../plans/domain/ports.js';
import type { Plan } from '../../../../plans/domain/entities.js';
import { GetHouseholdDashboardUseCase } from '../GetHouseholdDashboardUseCase.js';

const PLAN_ID = '01900000-0000-7000-8000-000000000001' as PlanId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;
const USER_ID = '01900000-0000-7000-8000-000000000003' as UserId;

function makePlan(): Plan {
  return {
    id: PLAN_ID,
    householdId: HOUSEHOLD_ID,
    ownerUserId: null,
    name: 'Monthly Budget',
    type: 'household',
    periodKind: 'monthly',
    period: { start: '2025-01-01' as any, end: '2025-01-31' as any },
    status: 'active',
    baseCurrency: 'PLN' as any,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Plan;
}

describe('GetHouseholdDashboardUseCase', () => {
  let planRepo: ReturnType<typeof mock<PlanRepository>>;
  let dashboardReader: ReturnType<typeof mock<HouseholdDashboardReader>>;
  let useCase: GetHouseholdDashboardUseCase;

  beforeEach(() => {
    planRepo = mock<PlanRepository>();
    dashboardReader = mock<HouseholdDashboardReader>();
    useCase = new GetHouseholdDashboardUseCase(planRepo, dashboardReader);
  });

  it('returns dashboard data when plan exists', async () => {
    const plan = makePlan();
    const dashboardData = { plan, actualsView: {} } as unknown as HouseholdDashboardData;
    planRepo.findById.mockResolvedValue(plan);
    dashboardReader.read.mockResolvedValue(dashboardData);

    const result = await useCase.execute({
      planId: PLAN_ID,
      householdId: HOUSEHOLD_ID,
      viewerUserId: USER_ID,
    });

    expect(result).toBe(dashboardData);
    expect(dashboardReader.read).toHaveBeenCalledWith({
      householdId: HOUSEHOLD_ID,
      planId: PLAN_ID,
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
      viewerUserId: USER_ID,
    });
  });

  it('throws when plan is not found', async () => {
    planRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        planId: PLAN_ID,
        householdId: HOUSEHOLD_ID,
        viewerUserId: USER_ID,
      }),
    ).rejects.toThrow(/PLAN_NOT_FOUND/);
  });

  it('uses household scope when looking up the plan', async () => {
    planRepo.findById.mockResolvedValue(null);

    await useCase.execute({
      planId: PLAN_ID,
      householdId: HOUSEHOLD_ID,
      viewerUserId: USER_ID,
    }).catch(() => {});

    expect(planRepo.findById).toHaveBeenCalledWith(PLAN_ID, { householdId: HOUSEHOLD_ID });
  });
});
