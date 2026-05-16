import type { PlanId, PlannedItemId, HouseholdId } from '@power-budget/core';
import type { PlanRepository, PlannedItemRepository, HouseholdScope } from '../../domain/ports.js';
import type { RemovePlannedItemInput } from '../models/index.js';
export type { RemovePlannedItemInput };

export class RemovePlannedItemUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
  ) {}

  async execute(input: RemovePlannedItemInput): Promise<void> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    await this.plannedItemRepo.remove(input.itemId);
  }
}
