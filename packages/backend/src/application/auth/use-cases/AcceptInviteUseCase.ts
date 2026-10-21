import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
  JwtAccessTokenIssuer,
} from '../../../domain/auth/ports.js';
import type { AcceptInviteOutcome, Household } from '../../../domain/auth/entities.js';
import {
  InviteExpiredError,
  InviteAlreadyUsedError,
  InviteNotFoundError,
  EmailMismatchError,
  AlreadyInHouseholdError,
  HouseholdFullError,
  HouseholdNotEmptyError,
  UserNotFoundError,
} from '../../../domain/auth/errors.js';
import { MAX_HOUSEHOLD_MEMBERS } from '../../../domain/auth/invariants.js';
import { HouseholdInviteMailer } from '../services/HouseholdInviteMailer.js';

export interface AcceptInviteInput {
  readonly token: string;
  readonly acceptingUserId: UserId;
}

/** The new access token carries the joined household; the refresh token stays valid. */
export interface AcceptInviteOutput {
  readonly householdId: HouseholdId;
  readonly accessToken: string;
}

/**
 * The invitee, signed in with the invited email, joins the household (CLN-006).
 *
 * Registration gives every user a solo household. Rule: the invitee leaves it when it is
 * empty (only member, no plans, bank connections, accounts, transactions or custom
 * categories); it is then scheduled for deletion. A solo household with data is never
 * merged or dropped: accept fails with `household_not_empty` and nothing changes.
 */
export class AcceptInviteUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly userRepo: UserRepository,
    private readonly inviteRepo: HouseholdInviteRepository,
    private readonly jwtIssuer: JwtAccessTokenIssuer,
  ) {}

  async execute(input: AcceptInviteInput): Promise<AcceptInviteOutput> {
    const now = new Date();
    const invite = await this.inviteRepo.findByTokenHash(
      HouseholdInviteMailer.hashToken(input.token),
    );
    if (invite === null || invite.revokedAt !== null) {
      throw new InviteNotFoundError();
    }
    if (invite.acceptedAt !== null) {
      throw new InviteAlreadyUsedError();
    }
    if (invite.expiresAt.getTime() <= now.getTime()) {
      throw new InviteExpiredError();
    }

    const user = await this.userRepo.findById(input.acceptingUserId);
    if (user === null) {
      throw new UserNotFoundError();
    }
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new EmailMismatchError();
    }

    const current = await this.householdRepo.findByUserId(user.id);
    const leaveHouseholdId = await this.householdToLeave(current, invite.householdId);
    const outcome = await this.inviteRepo.acceptAndJoin({
      inviteId: invite.id,
      householdId: invite.householdId,
      userId: user.id,
      leaveHouseholdId,
      maxMembers: MAX_HOUSEHOLD_MEMBERS,
      at: now,
    });
    this.assertJoined(outcome);

    return {
      householdId: invite.householdId,
      accessToken: this.jwtIssuer.issue({ userId: user.id, householdId: invite.householdId }),
    };
  }

  /** The caller's own solo household, or null. Sharing a household with someone blocks the join. */
  private async householdToLeave(
    current: Household | null,
    target: HouseholdId,
  ): Promise<HouseholdId | null> {
    if (current === null) {
      return null;
    }
    if (current.id === target || (await this.householdRepo.countMembers(current.id)) > 1) {
      throw new AlreadyInHouseholdError();
    }

    return current.id;
  }

  private assertJoined(outcome: AcceptInviteOutcome): void {
    switch (outcome) {
      case 'joined':
        return;
      // Lost a race with a concurrent accept, revoke or resend of the same invite.
      case 'invite_unavailable':
        throw new InviteAlreadyUsedError();
      case 'household_full':
        throw new HouseholdFullError();
      case 'household_not_empty':
        throw new HouseholdNotEmptyError();
      default: {
        const unreachable: never = outcome;
        throw new Error(`Unknown accept outcome ${String(unreachable)}`);
      }
    }
  }
}
