import type { UserId, HouseholdId } from '@power-budget/core';
import type { Plan } from '../../domain/entities.js';
import type { PlanRepository } from '../../domain/ports.js';
import type { ListActivePlansInput } from '../models/index.js';
export type { ListActivePlansInput };

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
