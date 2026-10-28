import type { HouseholdId, UserId, HouseholdInviteId } from '@power-budget/core';
import type { HouseholdInviteRepository, UserRepository } from '../../../domain/auth/ports.js';
import { InviteNotFoundError, UserNotFoundError } from '../../../domain/auth/errors.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';
import type { HouseholdInviteMailer } from '../services/HouseholdInviteMailer.js';
import { toHouseholdInviteView, type HouseholdInviteView } from './HouseholdInviteView.js';

export interface ResendHouseholdInviteInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly inviteId: HouseholdInviteId;
}

/** Sends an open invite again with a new token and a new 7-day expiry; the old link dies. */
export class ResendHouseholdInviteUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly inviteRepo: HouseholdInviteRepository,
    private readonly access: HouseholdAccess,
    private readonly mailer: HouseholdInviteMailer,
  ) {}

  async execute(input: ResendHouseholdInviteInput): Promise<HouseholdInviteView> {
    await this.access.assertOwner(input.householdId, input.userId);
    const inviter = await this.userRepo.findById(input.userId);
    if (inviter === null) {
      throw new UserNotFoundError();
    }

    const now = new Date();
    const token = this.mailer.issueToken(now);
    const invite = await this.inviteRepo.rotateToken(
      input.inviteId,
      input.householdId,
      token.tokenHash,
      token.expiresAt,
    );
    if (invite === null) {
      throw new InviteNotFoundError();
    }
    await this.mailer.send(invite, token.token, inviter);

    return toHouseholdInviteView(invite, now);
  }
}
