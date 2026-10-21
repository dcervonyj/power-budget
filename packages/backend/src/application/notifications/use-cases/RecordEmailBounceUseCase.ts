import type { NotificationRepository } from '../../../domain/notifications/ports.js';

export interface RecordEmailBounceInput {
  /** Provider event type, e.g. `email.bounced`. Other event types are ignored. */
  readonly type: unknown;
  readonly email: unknown;
}

export interface RecordEmailBounceOutput {
  readonly suppressed: boolean;
}

const BOUNCE_EVENT = 'email.bounced';

/**
 * Suppresses future email to an address that hard-bounced. The caller has
 * already verified the webhook signature; the payload fields are untrusted
 * shapes until checked here.
 */
export class RecordEmailBounceUseCase {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(input: RecordEmailBounceInput): Promise<RecordEmailBounceOutput> {
    if (input.type !== BOUNCE_EVENT || typeof input.email !== 'string' || input.email === '') {
      return { suppressed: false };
    }

    await this.notificationRepo.setEmailBouncing(input.email);

    return { suppressed: true };
  }
}
