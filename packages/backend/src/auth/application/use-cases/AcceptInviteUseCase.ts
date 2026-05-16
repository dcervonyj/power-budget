import { createHash } from 'node:crypto';
import type { UserId } from '@power-budget/core';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
} from '../../domain/ports.js';
import {
  InviteExpiredError,
  InviteAlreadyUsedError,
  EmailMismatchError,
  AlreadyInHouseholdError,
} from '../../domain/errors.js';
import type { AcceptInviteInput } from '../models/index.js';
export type { AcceptInviteInput };

export class AcceptInviteUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly userRepo: UserRepository,
    private readonly inviteRepo: HouseholdInviteRepository,
  ) {}

  async execute(input: AcceptInviteInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const invite = await this.inviteRepo.findByTokenHash(tokenHash);
    if (invite === null) {
      throw new InviteExpiredError();
    }

    if (invite.expiresAt < new Date()) {
      throw new InviteExpiredError();
    }

    if (invite.acceptedAt !== null) {
      throw new InviteAlreadyUsedError();
    }

    const user = await this.userRepo.findById(input.acceptingUserId);
    if (user === null) {
      throw new InviteExpiredError();
    }

    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new EmailMismatchError();
    }

    const existingHousehold = await this.householdRepo.findByUserId(input.acceptingUserId);
    if (existingHousehold !== null) {
      throw new AlreadyInHouseholdError();
    }

    await this.householdRepo.addMember(invite.householdId, input.acceptingUserId, 'member');
    await this.inviteRepo.accept(invite.id, new Date());
  }
}
