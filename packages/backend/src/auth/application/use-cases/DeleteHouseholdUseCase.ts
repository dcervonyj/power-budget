import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdRepository } from '../../domain/ports.js';
import { HouseholdNotFoundError } from '../../domain/errors.js';
import type { DeleteHouseholdInput, DeleteHouseholdOutput } from '../models/index.js';
export type { DeleteHouseholdInput, DeleteHouseholdOutput };

export class DeleteHouseholdUseCase {
  private static readonly DELETE_DELAY_DAYS = 30;

  constructor(private readonly householdRepo: HouseholdRepository) {}

  async execute(input: DeleteHouseholdInput): Promise<DeleteHouseholdOutput> {
    const household = await this.householdRepo.findById(input.householdId);
    if (household === null) {
      throw new HouseholdNotFoundError();
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + DeleteHouseholdUseCase.DELETE_DELAY_DAYS);

    await this.householdRepo.scheduleDelete(input.householdId, scheduledFor);

    return { scheduledFor };
  }
}
