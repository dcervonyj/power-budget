import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdInviteRepository } from '../../../domain/auth/ports.js';
import { InviteNotFoundError } from '../../../domain/auth/errors.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';

export interface RevokeHouseholdInviteInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly inviteId: string;
}

/** The owner withdraws an open invite; its link stops working at once. */
export class RevokeHouseholdInviteUseCase {
  constructor(
    private readonly inviteRepo: HouseholdInviteRepository,
    private readonly access: HouseholdAccess,
  ) {}

  async execute(input: RevokeHouseholdInviteInput): Promise<void> {
    await this.access.assertOwner(input.householdId, input.userId);
    const revoked = await this.inviteRepo.revoke(input.inviteId, input.householdId, new Date());
    if (!revoked) {
      throw new InviteNotFoundError();
    }
  }
}
