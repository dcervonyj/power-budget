import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
  JwtAccessTokenIssuer,
} from '../../../domain/auth/ports.js';
import { AcceptInviteUseCase } from './AcceptInviteUseCase.js';
import { HouseholdInviteMailer } from '../services/HouseholdInviteMailer.js';
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
import {
  HOUSEHOLD_ID,
  INVITE_ID,
  PARTNER_EMAIL,
  PARTNER_ID,
  SOLO_HOUSEHOLD_ID,
  makeHousehold,
  makeInvite,
  makeUser,
} from '../../../test/doubles/householdInviteFixtures.js';

const TOKEN = 'raw-token';
const TOKEN_HASH = HouseholdInviteMailer.hashToken(TOKEN);
const NOW = new Date('2026-10-21T12:00:00Z');
const PARTNER = makeUser({ id: PARTNER_ID, email: 'Bob@Example.com', displayName: 'Bob' });

describe('AcceptInviteUseCase', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let inviteRepo: ReturnType<typeof mock<HouseholdInviteRepository>>;
  let jwtIssuer: ReturnType<typeof mock<JwtAccessTokenIssuer>>;
  let useCase: AcceptInviteUseCase;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    householdRepo = mock<HouseholdRepository>();
    userRepo = mock<UserRepository>();
    inviteRepo = mock<HouseholdInviteRepository>();
    jwtIssuer = mock<JwtAccessTokenIssuer>();
    useCase = new AcceptInviteUseCase(householdRepo, userRepo, inviteRepo, jwtIssuer);

    inviteRepo.findByTokenHash.mockResolvedValue(
      makeInvite({ tokenHash: TOKEN_HASH, expiresAt: new Date(NOW.getTime() + 60_000) }),
    );
    userRepo.findById.mockResolvedValue(PARTNER);
    householdRepo.findByUserId.mockResolvedValue(makeHousehold({ id: SOLO_HOUSEHOLD_ID }));
    householdRepo.countMembers.mockResolvedValue(1);
    inviteRepo.acceptAndJoin.mockResolvedValue('joined');
    jwtIssuer.issue.mockReturnValue('new-access-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function accept(): ReturnType<AcceptInviteUseCase['execute']> {
    return useCase.execute({ token: TOKEN, acceptingUserId: PARTNER_ID });
  }

  it('joins the household, leaving the solo household, and returns a token for the new household', async () => {
    const result = await accept();

    expect(result).toEqual({ householdId: HOUSEHOLD_ID, accessToken: 'new-access-token' });
    expect(inviteRepo.findByTokenHash).toHaveBeenCalledWith(TOKEN_HASH);
    expect(householdRepo.countMembers).toHaveBeenCalledWith(SOLO_HOUSEHOLD_ID);
    expect(inviteRepo.acceptAndJoin).toHaveBeenCalledWith({
      inviteId: INVITE_ID,
      householdId: HOUSEHOLD_ID,
      userId: PARTNER_ID,
      leaveHouseholdId: SOLO_HOUSEHOLD_ID,
      maxMembers: MAX_HOUSEHOLD_MEMBERS,
      at: NOW,
    });
    expect(jwtIssuer.issue).toHaveBeenCalledWith({ userId: PARTNER_ID, householdId: HOUSEHOLD_ID });
  });

  it('joins without leaving anything when the user has no household', async () => {
    householdRepo.findByUserId.mockResolvedValue(null);

    await accept();

    expect(inviteRepo.acceptAndJoin.mock.calls[0]?.[0].leaveHouseholdId).toBeNull();
    expect(householdRepo.countMembers).not.toHaveBeenCalled();
  });

  it('rejects an unknown token with invite_not_found', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(null);

    await expect(accept()).rejects.toThrow(InviteNotFoundError);
  });

  it('rejects a revoked invite with invite_not_found', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite({ revokedAt: NOW }));

    await expect(accept()).rejects.toThrow(InviteNotFoundError);
  });

  it('rejects a used invite', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite({ acceptedAt: NOW }));

    await expect(accept()).rejects.toThrow(InviteAlreadyUsedError);
  });

  it('rejects an invite at its expiry instant', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(makeInvite({ expiresAt: NOW }));

    await expect(accept()).rejects.toThrow(InviteExpiredError);
    expect(inviteRepo.acceptAndJoin).not.toHaveBeenCalled();
  });

  it('rejects an unknown user', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(accept()).rejects.toThrow(UserNotFoundError);
  });

  it('rejects a user signed in with another email', async () => {
    userRepo.findById.mockResolvedValue(makeUser({ id: PARTNER_ID, email: 'eve@example.com' }));

    await expect(accept()).rejects.toThrow(EmailMismatchError);
    expect(inviteRepo.acceptAndJoin).not.toHaveBeenCalled();
  });

  it('compares the invited email case-insensitively', async () => {
    inviteRepo.findByTokenHash.mockResolvedValue(
      makeInvite({ email: PARTNER_EMAIL.toUpperCase() }),
    );

    await expect(accept()).resolves.toMatchObject({ householdId: HOUSEHOLD_ID });
  });

  it('rejects a member of the same household', async () => {
    householdRepo.findByUserId.mockResolvedValue(makeHousehold({ id: HOUSEHOLD_ID }));

    await expect(accept()).rejects.toThrow(AlreadyInHouseholdError);
  });

  it('rejects a user who shares another household with someone', async () => {
    householdRepo.countMembers.mockResolvedValue(2);

    await expect(accept()).rejects.toThrow(AlreadyInHouseholdError);
    expect(inviteRepo.acceptAndJoin).not.toHaveBeenCalled();
  });

  it.each([
    ['invite_unavailable', InviteAlreadyUsedError],
    ['household_full', HouseholdFullError],
    ['household_not_empty', HouseholdNotEmptyError],
  ] as const)('maps the %s outcome to %o', async (outcome, error) => {
    inviteRepo.acceptAndJoin.mockResolvedValue(outcome);

    await expect(accept()).rejects.toThrow(error);
    expect(jwtIssuer.issue).not.toHaveBeenCalled();
  });
});
