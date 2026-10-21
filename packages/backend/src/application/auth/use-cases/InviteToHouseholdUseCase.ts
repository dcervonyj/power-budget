import { uuidv7 } from 'uuidv7';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
} from '../../../domain/auth/ports.js';
import {
  CannotInviteSelfError,
  HouseholdFullError,
  UserNotFoundError,
} from '../../../domain/auth/errors.js';
import { MAX_HOUSEHOLD_MEMBERS } from '../../../domain/auth/invariants.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';
import type { HouseholdInviteMailer } from '../services/HouseholdInviteMailer.js';
import { toHouseholdInviteView, type HouseholdInviteView } from './HouseholdInviteView.js';

export interface InviteToHouseholdInput {
  readonly inviterUserId: UserId;
  readonly inviteeEmail: string;
  readonly householdId: HouseholdId;
}

/**
 * The owner invites their partner by email (CLN-006). A household has one open invite at a
 * time: a new invite revokes the previous one. The email goes out through the outbox.
 */
export class InviteToHouseholdUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly userRepo: UserRepository,
    private readonly inviteRepo: HouseholdInviteRepository,
    private readonly access: HouseholdAccess,
    private readonly mailer: HouseholdInviteMailer,
  ) {}

  async execute(input: InviteToHouseholdInput): Promise<HouseholdInviteView> {
    await this.access.assertOwner(input.householdId, input.inviterUserId);
    const inviter = await this.userRepo.findById(input.inviterUserId);
    if (inviter === null) {
      throw new UserNotFoundError();
    }
    const email = input.inviteeEmail.trim().toLowerCase();
    if (email === inviter.email.toLowerCase()) {
      throw new CannotInviteSelfError();
    }
    if ((await this.householdRepo.countMembers(input.householdId)) >= MAX_HOUSEHOLD_MEMBERS) {
      throw new HouseholdFullError();
    }

    const now = new Date();
    const token = this.mailer.issueToken(now);
    const invite = await this.inviteRepo.replaceOpen(
      {
        id: uuidv7(),
        householdId: input.householdId,
        email,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        invitedByUserId: inviter.id,
      },
      now,
    );
    await this.mailer.send(invite, token.token, inviter);

    return toHouseholdInviteView(invite, now);
  }
}
