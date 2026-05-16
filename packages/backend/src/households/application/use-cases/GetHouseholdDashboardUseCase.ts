import type { PlanId, HouseholdId, UserId } from '@power-budget/core';
import type {
  PlanRepository,
  HouseholdScope,
  HouseholdDashboardReader,
  HouseholdDashboardData,
} from '../../../plans/domain/ports.js';

export interface GetHouseholdDashboardInput {
  readonly householdId: HouseholdId;
  readonly planId: PlanId;
  readonly viewerUserId: UserId;
}

export class GetHouseholdDashboardUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly dashboardReader: HouseholdDashboardReader,
  ) {}

  async execute(input: GetHouseholdDashboardInput): Promise<HouseholdDashboardData> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    return this.dashboardReader.read({
      householdId: input.householdId,
      planId: input.planId,
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
      viewerUserId: input.viewerUserId,
    });
  }
}
