import type { UserId, HouseholdId, PlanId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository } from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface GetPlanInput {
  readonly planId: PlanId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class GetPlanUseCase {
  constructor(private readonly planRepo: PlanRepository) {}

  execute(input: GetPlanInput): Promise<Plan> {
    return findVisiblePlan(this.planRepo, input);
  }
}
