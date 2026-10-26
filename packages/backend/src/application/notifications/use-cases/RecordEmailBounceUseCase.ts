import type { NotificationRepository } from '../../../domain/notifications/ports.js';

export interface RecordEmailBounceInput {
  /** Provider event type, e.g. `email.bounced`. Other event types are ignored. */
  readonly type: unknown;
  /** Recipient addresses of the bounced email (Resend `data.to`). */
  readonly recipients: unknown;
}

export interface RecordEmailBounceOutput {
  readonly suppressed: boolean;
}

const BOUNCE_EVENT = 'email.bounced';

/**
 * Suppresses future email to the addresses of an email that hard-bounced.
 * The caller has already verified the webhook signature; the payload fields
 * are untrusted shapes until checked here.
 */
export class RecordEmailBounceUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(input: RecordEmailBounceInput): Promise<RecordEmailBounceOutput> {
    if (input.type !== BOUNCE_EVENT) {
      return { suppressed: false };
    }

    const addresses = this.usableAddresses(input.recipients);
    for (const address of addresses) {
      await this.notificationRepo.setEmailBouncing(address);
    }

    return { suppressed: addresses.length > 0 };
  }

  private usableAddresses(recipients: unknown): string[] {
    const candidates: unknown[] = Array.isArray(recipients) ? recipients : [recipients];

    return candidates.filter(
      (candidate): candidate is string => typeof candidate === 'string' && candidate !== '',
    );
  }
}
