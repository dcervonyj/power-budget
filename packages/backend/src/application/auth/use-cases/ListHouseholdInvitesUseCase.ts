import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdInviteRepository } from '../../../domain/auth/ports.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';
import { toHouseholdInviteView, type HouseholdInviteView } from './HouseholdInviteView.js';

export interface ListHouseholdInvitesInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

/** The household's open invite (pending or expired), for the owner's resend / revoke UI. */
export class ListHouseholdInvitesUseCase {
  constructor(
    private readonly inviteRepo: HouseholdInviteRepository,
    private readonly access: HouseholdAccess,
  ) {}

  async execute(input: ListHouseholdInvitesInput): Promise<HouseholdInviteView[]> {
    await this.access.assertOwner(input.householdId, input.userId);
    const now = new Date();
    const invites = await this.inviteRepo.listOpen(input.householdId);

    return invites.map((invite) => toHouseholdInviteView(invite, now));
  }
}
