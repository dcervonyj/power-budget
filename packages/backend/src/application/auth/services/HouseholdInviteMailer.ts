import { createHash, randomBytes } from 'node:crypto';
import type {
  AppConfigPort,
  HouseholdRepository,
  NotificationOutboxPort,
  UserRepository,
} from '../../../domain/auth/ports.js';
import type { HouseholdInvite, User } from '../../../domain/auth/entities.js';
import type { HouseholdInvitePayload } from '../../../domain/notifications/entities.js';
import { HouseholdNotFoundError } from '../../../domain/auth/errors.js';
import { HOUSEHOLD_INVITE_TTL_MS } from '../../../domain/auth/invariants.js';

const TOKEN_BYTES = 32;

/** A fresh single-use token. Only `tokenHash` is stored; `token` goes into the email link. */
export interface InviteToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/**
 * Issues invite tokens and queues the invite email in the notification outbox. The raw
 * token travels only in the payload `link`, which the dispatcher strips once the email is
 * sent or given up on (SECRET_PAYLOAD_KEYS).
 */
export class HouseholdInviteMailer {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly householdRepo: HouseholdRepository,
    private readonly outbox: NotificationOutboxPort,
    private readonly config: AppConfigPort,
  ) {}

  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  issueToken(now: Date): InviteToken {
    const token = randomBytes(TOKEN_BYTES).toString('hex');

    return {
      token,
      tokenHash: HouseholdInviteMailer.hashToken(token),
      expiresAt: new Date(now.getTime() + HOUSEHOLD_INVITE_TTL_MS),
    };
  }

  /**
   * An invitee with an account gets the email in their own locale (and the bounce
   * check); otherwise it goes to the bare address in the inviter's locale.
   */
  async send(invite: HouseholdInvite, token: string, inviter: User): Promise<void> {
    const household = await this.householdRepo.findById(invite.householdId);
    if (household === null) {
      throw new HouseholdNotFoundError();
    }
    const payload: HouseholdInvitePayload = {
      link: this.buildLink(token),
      inviterName: inviter.displayName,
      householdName: household.name,
    };
    // One email per token: a resend rotates the token, so it is a new notification.
    const dedupeKey = `household_invite:${invite.id}:${invite.tokenHash}`;

    const invitee = await this.userRepo.findByEmail(invite.email);
    if (invitee !== null) {
      await this.outbox.enqueue({
        kind: 'household_invite',
        userId: invitee.id,
        payload: { ...payload },
        dedupeKey,
      });

      return;
    }
    await this.outbox.enqueueToAddress({
      kind: 'household_invite',
      email: invite.email,
      locale: inviter.localePreference ?? inviter.defaultLocale,
      householdId: invite.householdId,
      payload: { ...payload },
      dedupeKey,
    });
  }

  /** The web app's invite screen (/invite/accept) posts `?token=` to POST /households/invites/accept. */
  private buildLink(token: string): string {
    const baseUrl = this.config.get('APP_BASE_URL').replace(/\/+$/, '');

    return `${baseUrl}/invite/accept?token=${encodeURIComponent(token)}`;
  }
}
