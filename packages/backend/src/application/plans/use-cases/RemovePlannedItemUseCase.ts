import type { PlanId, PlannedItemId, HouseholdId } from '@power-budget/core';
import type {
  PlanRepository,
  PlannedItemRepository,
  HouseholdScope,
} from '../../../domain/plans/ports.js';

export interface RemovePlannedItemInput {
  readonly planId: PlanId;
  readonly itemId: PlannedItemId;
  readonly householdId: HouseholdId;
}

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
