import type { UserId, HouseholdId } from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type { PlanRepository } from '../../../domain/plans/ports.js';

export interface ListActivePlansInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly date: Date;
}

export class ListActivePlansUseCase {
  constructor(private readonly planRepo: PlanRepository) {}

  execute(input: ListActivePlansInput): Promise<Plan[]> {
    return this.planRepo.listActive({
      userId: input.userId,
      householdId: input.householdId,
      date: input.date,
    });
  }
}
