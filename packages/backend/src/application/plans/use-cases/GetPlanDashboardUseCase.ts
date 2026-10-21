import type { PlanId, HouseholdId, UserId, PlanActualsView } from '@power-budget/core';
import type { PlanRepository, PlanActualsReader } from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface GetPlanDashboardInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly asOf: Date;
}

export class GetPlanDashboardUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly actualsReader: PlanActualsReader,
  ) {}

  async execute(input: GetPlanDashboardInput): Promise<PlanActualsView> {
    // A partner's personal plan is not visible either (PLAN_NOT_FOUND).
    const plan = await findVisiblePlan(this.planRepo, input);

    return this.actualsReader.read(plan, input.asOf);
  }
}
