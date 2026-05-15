import { PlannedItemId } from '@power-budget/core';
import type { PlanId, UserId, HouseholdId, Money } from '@power-budget/core';
import type {
  PlannedItem,
  NewPlannedItem,
  PlannedDirection,
} from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlannedItemRepository,
  HouseholdScope,
} from '../../../domain/plans/ports.js';
import type { CategoryId } from '@power-budget/core';

export interface AddPlannedItemInput {
  readonly planId: PlanId;
  readonly categoryId: CategoryId;
  readonly direction: PlannedDirection;
  readonly amount: Money;
  readonly note?: string | null;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export class AddPlannedItemUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly plannedItemRepo: PlannedItemRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(input: AddPlannedItemInput): Promise<PlannedItem> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    const newItem: NewPlannedItem = {
      id: PlannedItemId.of(this.generateId()),
      planId: input.planId,
      householdId: input.householdId,
      categoryId: input.categoryId,
      direction: input.direction,
      amount: input.amount,
      note: input.note ?? null,
    };

    return this.plannedItemRepo.add(newItem);
  }
}
