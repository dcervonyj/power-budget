import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
} from '../../domain/ports.js';
import { AcceptInviteUseCase } from './AcceptInviteUseCase.js';
import {
  InviteExpiredError,
  InviteAlreadyUsedError,
  EmailMismatchError,
  AlreadyInHouseholdError,
} from '../../domain/errors.js';
import type { User, HouseholdInvite } from '../../domain/entities.js';

const USER_ID = 'user1' as UserId;
const HH_ID = 'hh1' as HouseholdId;
const FUTURE = new Date(Date.now() + 86400000);
const PAST = new Date(Date.now() - 86400000);

const TEST_TOKEN = 'test-token';
const TEST_TOKEN_HASH = createHash('sha256').update(TEST_TOKEN).digest('hex');

function makeUser(email: string): User {
  return {
    id: USER_ID,
    email,
    displayName: 'Test',
    localePreference: null,
    defaultLocale: 'en',
    passwordHash: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeInvite(overrides: Partial<HouseholdInvite> = {}): HouseholdInvite {
  return {
    id: 'inv1',
    householdId: HH_ID,
    email: 'user@test.com',
    tokenHash: TEST_TOKEN_HASH,
    expiresAt: FUTURE,
    acceptedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AcceptInviteUseCase', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let inviteRepo: ReturnType<typeof mock<HouseholdInviteRepository>>;
  let useCase: AcceptInviteUseCase;

  beforeEach(() => {
    householdRepo = mock<HouseholdRepository>();
    userRepo = mock<UserRepository>();
    inviteRepo = mock<HouseholdInviteRepository>();
    useCase = new AcceptInviteUseCase(householdRepo, userRepo, inviteRepo);
  });

  it('accepts valid invite', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite());
    userRepo.findById.mockResolvedValue(makeUser('user@test.com'));
    householdRepo.findByUserId.mockResolvedValue(null);
    householdRepo.addMember.mockResolvedValue({
      householdId: HH_ID,
      userId: USER_ID,
      role: 'member',
      joinedAt: new Date(),
    });

    await expect(
      useCase.execute({ token: TEST_TOKEN, acceptingUserId: USER_ID }),
    ).resolves.not.toThrow();
    expect(householdRepo.addMember).toHaveBeenCalledWith(HH_ID, USER_ID, 'member');
    expect(inviteRepo.accept).toHaveBeenCalledWith('inv1', expect.any(Date));
  });

  it('throws InviteExpiredError when invite not found', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(null);

    await expect(useCase.execute({ token: TEST_TOKEN, acceptingUserId: USER_ID })).rejects.toThrow(
      InviteExpiredError,
    );
  });

  it('throws InviteExpiredError for expired token', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite({ expiresAt: PAST }));
    userRepo.findById.mockResolvedValue(makeUser('user@test.com'));
    householdRepo.findByUserId.mockResolvedValue(null);

    await expect(useCase.execute({ token: TEST_TOKEN, acceptingUserId: USER_ID })).rejects.toThrow(
      InviteExpiredError,
    );
  });

  it('throws InviteAlreadyUsedError for used invite', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite({ acceptedAt: PAST }));
    userRepo.findById.mockResolvedValue(makeUser('user@test.com'));
    householdRepo.findByUserId.mockResolvedValue(null);

    await expect(useCase.execute({ token: TEST_TOKEN, acceptingUserId: USER_ID })).rejects.toThrow(
      InviteAlreadyUsedError,
    );
  });

  it('throws EmailMismatchError when emails differ', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite({ email: 'other@test.com' }));
    userRepo.findById.mockResolvedValue(makeUser('user@test.com'));
    householdRepo.findByUserId.mockResolvedValue(null);

    await expect(useCase.execute({ token: TEST_TOKEN, acceptingUserId: USER_ID })).rejects.toThrow(
      EmailMismatchError,
    );
  });

  it('throws AlreadyInHouseholdError if user already has household', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite());
    userRepo.findById.mockResolvedValue(makeUser('user@test.com'));
    householdRepo.findByUserId.mockResolvedValue({
      id: HH_ID,
      name: 'existing',
      baseCurrency: 'PLN',
      createdAt: new Date(),
    });

    await expect(useCase.execute({ token: TEST_TOKEN, acceptingUserId: USER_ID })).rejects.toThrow(
      AlreadyInHouseholdError,
    );
  });
});
