import { HouseholdInviteId } from '@power-budget/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { HouseholdInviteRepository, UserRepository } from '../../../domain/auth/ports.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';
import type { HouseholdInviteMailer, InviteToken } from '../services/HouseholdInviteMailer.js';
import { ResendHouseholdInviteUseCase } from './ResendHouseholdInviteUseCase.js';
import { RevokeHouseholdInviteUseCase } from './RevokeHouseholdInviteUseCase.js';
import { ListHouseholdInvitesUseCase } from './ListHouseholdInvitesUseCase.js';
import {
  HouseholdOwnerRequiredError,
  InviteNotFoundError,
  UserNotFoundError,
} from '../../../domain/auth/errors.js';
import {
  HOUSEHOLD_ID,
  INVITE_ID,
  OWNER_ID,
  PARTNER_EMAIL,
  makeInvite,
  makeUser,
} from '../../../test/doubles/householdInviteFixtures.js';

const NOW = new Date('2026-10-21T12:00:00Z');
const NEW_EXPIRY = new Date('2026-10-28T12:00:00Z');
const EXPIRED_ID = HouseholdInviteId.of('01900000-0000-7000-8000-0000000000d1');
const TOKEN: InviteToken = { token: 'raw-2', tokenHash: 'hash-2', expiresAt: NEW_EXPIRY };
const INPUT = { userId: OWNER_ID, householdId: HOUSEHOLD_ID, inviteId: INVITE_ID };

describe('household invite management', () => {
  let userRepo: ReturnType<typeof createMock<UserRepository>>;
  let inviteRepo: ReturnType<typeof createMock<HouseholdInviteRepository>>;
  let access: ReturnType<typeof createMock<HouseholdAccess>>;
  let mailer: ReturnType<typeof createMock<HouseholdInviteMailer>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    userRepo = createMock<UserRepository>();
    inviteRepo = createMock<HouseholdInviteRepository>();
    access = createMock<HouseholdAccess>();
    mailer = createMock<HouseholdInviteMailer>();
    access.assertOwner.mockResolvedValue(undefined);
    userRepo.findById.mockResolvedValue(makeUser());
    mailer.issueToken.mockReturnValue(TOKEN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ResendHouseholdInviteUseCase', () => {
    function resend(): ReturnType<ResendHouseholdInviteUseCase['execute']> {
      return new ResendHouseholdInviteUseCase(userRepo, inviteRepo, access, mailer).execute(INPUT);
    }

    it('rotates the token and expiry and emails the new link', async () => {
      const rotated = makeInvite({ tokenHash: 'hash-2', expiresAt: NEW_EXPIRY, createdAt: NOW });
      inviteRepo.rotateToken.mockResolvedValue(rotated);

      const view = await resend();

      expect(access.assertOwner).toHaveBeenCalledWith(HOUSEHOLD_ID, OWNER_ID);
      expect(inviteRepo.rotateToken).toHaveBeenCalledWith(
        INVITE_ID,
        HOUSEHOLD_ID,
        'hash-2',
        NEW_EXPIRY,
      );
      expect(mailer.send).toHaveBeenCalledWith(
        rotated,
        'raw-2',
        makeUser({
          createdAt: NOW,
          updatedAt: NOW,
        }),
      );
      expect(view).toEqual({
        id: INVITE_ID,
        email: PARTNER_EMAIL,
        status: 'pending',
        expiresAt: NEW_EXPIRY,
        createdAt: NOW,
      });
    });

    it('answers invite_not_found for an invite that is not open in the household', async () => {
      inviteRepo.rotateToken.mockResolvedValue(null);

      await expect(resend()).rejects.toThrow(InviteNotFoundError);
      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('refuses a non-owner', async () => {
      access.assertOwner.mockRejectedValue(new HouseholdOwnerRequiredError());

      await expect(resend()).rejects.toThrow(HouseholdOwnerRequiredError);
      expect(inviteRepo.rotateToken).not.toHaveBeenCalled();
    });

    it('fails when the inviter account is gone', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(resend()).rejects.toThrow(UserNotFoundError);
    });
  });

  describe('RevokeHouseholdInviteUseCase', () => {
    function revoke(): Promise<void> {
      return new RevokeHouseholdInviteUseCase(inviteRepo, access).execute(INPUT);
    }

    it('revokes the open invite of the household', async () => {
      inviteRepo.revoke.mockResolvedValue(true);

      await revoke();

      expect(inviteRepo.revoke).toHaveBeenCalledWith(INVITE_ID, HOUSEHOLD_ID, NOW);
    });

    it('answers invite_not_found when nothing was open', async () => {
      inviteRepo.revoke.mockResolvedValue(false);

      await expect(revoke()).rejects.toThrow(InviteNotFoundError);
    });

    it('refuses a non-owner', async () => {
      access.assertOwner.mockRejectedValue(new HouseholdOwnerRequiredError());

      await expect(revoke()).rejects.toThrow(HouseholdOwnerRequiredError);
      expect(inviteRepo.revoke).not.toHaveBeenCalled();
    });
  });

  describe('ListHouseholdInvitesUseCase', () => {
    it('lists open invites with their status', async () => {
      const pending = makeInvite({ expiresAt: NEW_EXPIRY, createdAt: NOW });
      const expired = makeInvite({
        id: EXPIRED_ID,
        expiresAt: NOW,
        createdAt: NOW,
      });
      inviteRepo.listOpen.mockResolvedValue([pending, expired]);

      const views = await new ListHouseholdInvitesUseCase(inviteRepo, access).execute({
        userId: OWNER_ID,
        householdId: HOUSEHOLD_ID,
      });

      expect(inviteRepo.listOpen).toHaveBeenCalledWith(HOUSEHOLD_ID);
      expect(views.map((view) => [view.id, view.status])).toEqual([
        [INVITE_ID, 'pending'],
        [EXPIRED_ID, 'expired'],
      ]);
    });
  });
});
