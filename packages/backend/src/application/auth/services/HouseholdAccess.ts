import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import {
  HouseholdNotFoundError,
  HouseholdOwnerRequiredError,
} from '../../../domain/auth/errors.js';

/** Role checks of the household endpoints, read from household_users (not from the JWT). */
export class HouseholdAccess {
  constructor(private readonly householdRepo: HouseholdRepository) {}

  /** Only the owner invites, resends and revokes (CLN-006). */
  async assertOwner(householdId: HouseholdId, userId: UserId): Promise<void> {
    const membership = await this.householdRepo.findMembership(householdId, userId);
    if (membership === null || membership.role !== 'owner') {
      throw new HouseholdOwnerRequiredError();
    }
  }

  /** Any member may read who is in the household; others get 404, as if it did not exist. */
  async assertMember(householdId: HouseholdId, userId: UserId): Promise<void> {
    const membership = await this.householdRepo.findMembership(householdId, userId);
    if (membership === null) {
      throw new HouseholdNotFoundError();
    }
  }
}
