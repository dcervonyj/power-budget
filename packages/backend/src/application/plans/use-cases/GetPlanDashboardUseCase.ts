import type { PlanId, HouseholdId, PlanActualsView } from '@power-budget/core';
import type {
  PlanRepository,
  PlanActualsReader,
  HouseholdScope,
} from '../../../domain/plans/ports.js';

export interface GetPlanDashboardInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly asOf: Date;
}

export class GetPlanDashboardUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly actualsReader: PlanActualsReader,
  ) {}

  async execute(input: GetPlanDashboardInput): Promise<PlanActualsView> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    return this.actualsReader.read(input.planId, input.asOf);
  }
}
