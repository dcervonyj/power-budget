import type { UserId, HouseholdId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository, PlanStatusFilter } from '../../../domain/plans/ports.js';

export interface ListPlansInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly status: PlanStatusFilter;
}

/** Household plans plus the user's own personal plans, filtered by archive status. */
export class ListPlansUseCase {
  constructor(private readonly planRepo: PlanRepository) {}

  execute(input: ListPlansInput): Promise<Plan[]> {
    return this.planRepo.list({
      householdId: input.householdId,
      viewerUserId: input.userId,
      status: input.status,
    });
  }
}
