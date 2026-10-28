import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  AppConfigPort,
  HouseholdRepository,
  UserRepository,
} from '../../../domain/auth/ports.js';
import type { NotificationOutbox } from '../../../domain/notifications/ports.js';
import { HouseholdNotFoundError } from '../../../domain/auth/errors.js';
import { HOUSEHOLD_INVITE_TTL_MS } from '../../../domain/auth/invariants.js';
import { HouseholdInviteMailer } from './HouseholdInviteMailer.js';
import {
  HOUSEHOLD_ID,
  PARTNER_EMAIL,
  PARTNER_ID,
  makeHousehold,
  makeInvite,
  makeUser,
} from '../../../test/doubles/householdInviteFixtures.js';

const INVITE = makeInvite({ tokenHash: 'abc' });
const LINK = 'https://app.example.com/invite/accept?token=raw%2Btoken';
const PAYLOAD = { link: LINK, inviterName: 'Ann', householdName: "Ann's household" };

describe('HouseholdInviteMailer', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let outbox: ReturnType<typeof mock<NotificationOutbox>>;
  let config: ReturnType<typeof mock<AppConfigPort>>;
  let mailer: HouseholdInviteMailer;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    householdRepo = mock<HouseholdRepository>();
    outbox = mock<NotificationOutbox>();
    config = mock<AppConfigPort>();
    config.get.mockReturnValue('https://app.example.com/');
    householdRepo.findById.mockResolvedValue(makeHousehold());
    mailer = new HouseholdInviteMailer(userRepo, householdRepo, outbox, config);
  });

  it('issues a random token whose sha256 is stored, valid for 7 days', () => {
    const now = new Date('2026-10-21T12:00:00Z');

    const first = mailer.issueToken(now);
    const second = mailer.issueToken(now);

    expect(first.token).toMatch(/^[0-9a-f]{64}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(HouseholdInviteMailer.hashToken(first.token));
    expect(first.tokenHash).not.toBe(first.token);
    expect(first.expiresAt).toEqual(new Date(now.getTime() + HOUSEHOLD_INVITE_TTL_MS));
  });

  it('emails an invitee who has an account through their user row', async () => {
    userRepo.findByEmail.mockResolvedValue(makeUser({ id: PARTNER_ID, email: PARTNER_EMAIL }));

    await mailer.send(INVITE, 'raw+token', makeUser());

    expect(userRepo.findByEmail).toHaveBeenCalledWith(PARTNER_EMAIL);
    expect(outbox.enqueue).toHaveBeenCalledWith({
      kind: 'household_invite',
      recipientUserId: PARTNER_ID,
      payload: PAYLOAD,
      dedupeKey: `household_invite:${INVITE.id}:abc`,
    });
    expect(outbox.enqueueToAddress).not.toHaveBeenCalled();
  });

  it("emails an unregistered invitee at the address, in the inviter's locale", async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await mailer.send(INVITE, 'raw+token', makeUser({ localePreference: 'pl' }));

    expect(outbox.enqueueToAddress).toHaveBeenCalledWith({
      kind: 'household_invite',
      email: PARTNER_EMAIL,
      locale: 'pl',
      householdId: HOUSEHOLD_ID,
      payload: PAYLOAD,
      dedupeKey: `household_invite:${INVITE.id}:abc`,
    });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('falls back to the default locale of the inviter', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await mailer.send(INVITE, 'raw+token', makeUser({ defaultLocale: 'uk' }));

    expect(outbox.enqueueToAddress.mock.calls[0]?.[0].locale).toBe('uk');
  });

  it('fails when the household is gone', async () => {
    householdRepo.findById.mockResolvedValue(null);

    await expect(mailer.send(INVITE, 'raw', makeUser())).rejects.toThrow(HouseholdNotFoundError);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
