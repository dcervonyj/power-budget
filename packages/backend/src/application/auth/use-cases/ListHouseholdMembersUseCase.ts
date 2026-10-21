import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdMember } from '../../../domain/auth/entities.js';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';

export interface ListHouseholdMembersInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

/** Who is in the caller's household (UI-013 household screen); any member may ask. */
export class ListHouseholdMembersUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly access: HouseholdAccess,
  ) {}

  async execute(input: ListHouseholdMembersInput): Promise<HouseholdMember[]> {
    await this.access.assertMember(input.householdId, input.userId);

    return this.householdRepo.listMembers(input.householdId);
  }
}
