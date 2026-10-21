import type { PlanId, UserId, HouseholdId } from '@power-budget/core';
import type { PlannedItem } from '../../../domain/plans/entities.js';
import type { PlanRepository, PlannedItemRepository } from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../plan-lookup.js';

export interface ListPlannedItemsInput {
  readonly planId: PlanId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class ListPlannedItemsUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
  ) {}

  async execute(input: ListPlannedItemsInput): Promise<PlannedItem[]> {
    const plan = await findVisiblePlan(this.planRepo, input);

    return this.plannedItemRepo.listByPlan(plan.id, { householdId: input.householdId });
  }
}
