import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
  AppConfigPort,
} from '../../../domain/auth/ports.js';
import { InviteToHouseholdUseCase } from './InviteToHouseholdUseCase.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import type { HouseholdMembership } from '../../../domain/auth/entities.js';

const INVITER_ID = 'inviter1' as UserId;
const HH_ID = 'hh1' as HouseholdId;

function makeMembership(role: 'owner' | 'member'): HouseholdMembership {
  return { householdId: HH_ID, userId: INVITER_ID, role, joinedAt: new Date() };
}

describe('InviteToHouseholdUseCase', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let inviteRepo: ReturnType<typeof mock<HouseholdInviteRepository>>;
  let config: ReturnType<typeof mock<AppConfigPort>>;
  let useCase: InviteToHouseholdUseCase;

  beforeEach(() => {
    householdRepo = mock<HouseholdRepository>();
    userRepo = mock<UserRepository>();
    inviteRepo = mock<HouseholdInviteRepository>();
    config = mock<AppConfigPort>();
    useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);
  });

  it('creates invite and returns URL for owner', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));
    config.get.mockReturnValue('https://app.example.com');
    inviteRepo.create.mockResolvedValue({
      id: 'inv1',
      householdId: HH_ID,
      email: 'bob@test.com',
      tokenHash: 'hash',
      expiresAt: new Date(),
      acceptedAt: null,
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      inviterUserId: INVITER_ID,
      inviteeEmail: 'bob@test.com',
      householdId: HH_ID,
    });

    expect(result.inviteUrl).toContain('https://app.example.com/invite/accept?token=');
    expect(inviteRepo.create).toHaveBeenCalledOnce();
  });

  it('throws UserNotFoundError for non-owner', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('member'));

    await expect(
      useCase.execute({
        inviterUserId: INVITER_ID,
        inviteeEmail: 'bob@test.com',
        householdId: HH_ID,
      }),
    ).rejects.toThrow(UserNotFoundError);
  });

  it('throws UserNotFoundError when not a member', async () => {
    householdRepo.findMembership.mockResolvedValue(null);

    await expect(
      useCase.execute({
        inviterUserId: INVITER_ID,
        inviteeEmail: 'bob@test.com',
        householdId: HH_ID,
      }),
    ).rejects.toThrow(UserNotFoundError);
  });
});
