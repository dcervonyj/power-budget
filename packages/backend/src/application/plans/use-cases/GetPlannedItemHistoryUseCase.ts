import type { HouseholdId, PlanId, PlannedItemId, UserId } from '@power-budget/core';
import type { PlannedItemVersion } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  PlannedItemVersionRepository,
} from '../../../domain/plans/ports.js';
import { findPlannedItemOfPlan, findVisiblePlan } from '../plan-lookup.js';

export interface GetPlannedItemHistoryInput {
  readonly planId: PlanId;
  readonly itemId: PlannedItemId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class GetPlannedItemHistoryUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly versionRepo: PlannedItemVersionRepository,
  ) {}

  async execute(input: GetPlannedItemHistoryInput): Promise<PlannedItemVersion[]> {
    const plan = await findVisiblePlan(this.planRepo, input);
    await findPlannedItemOfPlan(this.plannedItemRepo, plan, input.itemId);

    return this.versionRepo.listByItem(input.itemId, { householdId: input.householdId });
  }
}
