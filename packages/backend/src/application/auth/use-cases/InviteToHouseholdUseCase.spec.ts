import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
} from '../../../domain/auth/ports.js';
import { InviteToHouseholdUseCase } from './InviteToHouseholdUseCase.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';
import type { HouseholdInviteMailer, InviteToken } from '../services/HouseholdInviteMailer.js';
import {
  CannotInviteSelfError,
  HouseholdFullError,
  HouseholdOwnerRequiredError,
  UserNotFoundError,
} from '../../../domain/auth/errors.js';
import {
  HOUSEHOLD_ID,
  OWNER_ID,
  PARTNER_EMAIL,
  makeInvite,
  makeUser,
} from '../../../test/doubles/householdInviteFixtures.js';

const NOW = new Date('2026-10-21T12:00:00Z');
const EXPIRES_AT = new Date('2026-10-28T12:00:00Z');
const TOKEN: InviteToken = { token: 'raw', tokenHash: 'hashed', expiresAt: EXPIRES_AT };
const OWNER = makeUser();

describe('InviteToHouseholdUseCase', () => {
  let householdRepo: ReturnType<typeof createMock<HouseholdRepository>>;
  let userRepo: ReturnType<typeof createMock<UserRepository>>;
  let inviteRepo: ReturnType<typeof createMock<HouseholdInviteRepository>>;
  let access: ReturnType<typeof createMock<HouseholdAccess>>;
  let mailer: ReturnType<typeof createMock<HouseholdInviteMailer>>;
  let useCase: InviteToHouseholdUseCase;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    householdRepo = createMock<HouseholdRepository>();
    userRepo = createMock<UserRepository>();
    inviteRepo = createMock<HouseholdInviteRepository>();
    access = createMock<HouseholdAccess>();
    mailer = createMock<HouseholdInviteMailer>();
    useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, access, mailer);

    access.assertOwner.mockResolvedValue(undefined);
    userRepo.findById.mockResolvedValue(OWNER);
    householdRepo.countMembers.mockResolvedValue(1);
    mailer.issueToken.mockReturnValue(TOKEN);
    inviteRepo.replaceOpen.mockImplementation(async (invite) =>
      makeInvite({ ...invite, createdAt: NOW }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function invite(email: string): ReturnType<InviteToHouseholdUseCase['execute']> {
    return useCase.execute({
      inviterUserId: OWNER_ID,
      inviteeEmail: email,
      householdId: HOUSEHOLD_ID,
    });
  }

  it('stores the hashed token for the normalised email and emails the raw token', async () => {
    const view = await invite('  Bob@Example.COM ');

    expect(access.assertOwner).toHaveBeenCalledWith(HOUSEHOLD_ID, OWNER_ID);
    expect(mailer.issueToken).toHaveBeenCalledWith(NOW);
    const stored = inviteRepo.replaceOpen.mock.calls[0];
    expect(stored?.[0]).toMatchObject({
      householdId: HOUSEHOLD_ID,
      email: PARTNER_EMAIL,
      tokenHash: 'hashed',
      expiresAt: EXPIRES_AT,
      invitedByUserId: OWNER_ID,
    });
    expect(stored?.[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored?.[1]).toEqual(NOW);
    const sent = mailer.send.mock.calls[0];
    expect(sent?.[1]).toBe('raw');
    expect(sent?.[2]).toBe(OWNER);
    expect(view).toEqual({
      id: stored?.[0].id,
      email: PARTNER_EMAIL,
      status: 'pending',
      expiresAt: EXPIRES_AT,
      createdAt: NOW,
    });
  });

  it('refuses a non-owner and stores nothing', async () => {
    access.assertOwner.mockRejectedValue(new HouseholdOwnerRequiredError());

    await expect(invite(PARTNER_EMAIL)).rejects.toThrow(HouseholdOwnerRequiredError);
    expect(inviteRepo.replaceOpen).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('refuses to invite the inviter themselves', async () => {
    await expect(invite('ANN@example.com')).rejects.toThrow(CannotInviteSelfError);
  });

  it('refuses when the household already has two members', async () => {
    householdRepo.countMembers.mockResolvedValue(2);

    await expect(invite(PARTNER_EMAIL)).rejects.toThrow(HouseholdFullError);
    expect(inviteRepo.replaceOpen).not.toHaveBeenCalled();
  });

  it('fails when the inviter account is gone', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(invite(PARTNER_EMAIL)).rejects.toThrow(UserNotFoundError);
  });
});
