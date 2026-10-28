import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  MAX_DISPATCH_ATTEMPTS,
  type NotificationOutboxRow,
} from '../../../domain/notifications/entities.js';
import type {
  NotificationRepository,
  EmailChannel,
  TemplateRenderer,
  NotificationClaim,
} from '../../../domain/notifications/ports.js';
import {
  QUEUE_NOTIFICATION_DISPATCH,
  WORKER_DRAIN_DELAY_SECONDS,
} from '../../queue/queue.constants.js';
import type { DispatchNotificationJobPayload } from '../BullMQNotificationDispatchQueue.js';

export const SUBJECT_BY_KIND: Record<NotificationOutboxRow['kind'], string> = {
  over_budget: 'Over Budget Alert — Power Budget',
  weekly_digest: 'Your Weekly Budget Summary — Power Budget',
  reconnect_reminder: 'Bank Connection Expiring — Power Budget',
  magic_link: 'Your sign-in link — Power Budget',
  household_invite: 'You are invited to a household — Power Budget',
};

interface Recipient {
  readonly email: string;
  readonly locale: string;
  readonly emailBouncing: boolean;
}

const DEFAULT_LOCALE = 'en';

export type DeliveryOutcome =
  | { readonly status: 'sent' }
  | { readonly status: 'dropped'; readonly reason: string }
  | { readonly status: 'failed'; readonly error: Error }
  | { readonly status: 'retry'; readonly error: Error };

/** Another claim holds the row right now; BullMQ retries the job after its backoff. */
export class NotificationBusyError extends Error {
  constructor(outboxId: string) {
    super(`Notification ${outboxId} is being claimed by another worker`);
    this.name = 'NotificationBusyError';
  }
}

@Processor(QUEUE_NOTIFICATION_DISPATCH, {
  concurrency: 5,
  drainDelay: WORKER_DRAIN_DELAY_SECONDS,
})
export class DispatchNotificationProcessor extends WorkerHost {
  constructor(
    private readonly outbox: NotificationRepository,
    private readonly emailChannel: EmailChannel,
    private readonly templateRenderer: TemplateRenderer,
  ) {
    super();
  }

  async process(job: Job<DispatchNotificationJobPayload>): Promise<void> {
    const { outboxId } = job.data;

    const notification = await this.outbox.findById(outboxId);
    if (notification === null || notification.sentAt !== null || notification.failedAt !== null) {
      return;
    }

    const claim = await this.outbox.claimForDispatch(outboxId);
    if (claim === null) {
      await this.assertNoLongerPending(outboxId);

      return;
    }

    this.report(outboxId, await this.deliver(claim));
  }

  /** Runs after the claim committed: no transaction or connection is held while sending. Never throws for a delivery failure. */
  private async deliver(claim: NotificationClaim): Promise<DeliveryOutcome> {
    const { notification } = claim;
    const user = this.resolveRecipient(claim);
    if (user === null || user.emailBouncing) {
      await claim.markFailed();

      return {
        status: 'dropped',
        reason: user === null ? 'recipient not found' : 'email bouncing',
      };
    }

    try {
      const html = await this.templateRenderer.render(
        notification.kind,
        user.locale,
        this.buildVariables(notification.payload),
      );
      await this.emailChannel.send({
        to: user.email,
        subject: SUBJECT_BY_KIND[notification.kind],
        html,
        idempotencyKey: `notification-${notification.id}`,
      });
    } catch (err) {
      return this.onDeliveryError(claim, this.toError(err));
    }

    await claim.markSent();

    return { status: 'sent' };
  }

  private async onDeliveryError(claim: NotificationClaim, error: Error): Promise<DeliveryOutcome> {
    if (claim.notification.attempts >= MAX_DISPATCH_ATTEMPTS) {
      await claim.markFailed();

      return { status: 'failed', error };
    }

    return { status: 'retry', error };
  }

  /** Throws for `retry` so BullMQ schedules the next attempt with backoff. */
  private report(outboxId: string, outcome: DeliveryOutcome): void {
    switch (outcome.status) {
      case 'sent':
        return;
      case 'dropped':
        console.warn(`[DispatchNotification] ${outboxId} dropped: ${outcome.reason}`);

        return;
      case 'failed':
        console.error(
          `[DispatchNotification] ${outboxId} failed after ${MAX_DISPATCH_ATTEMPTS} attempts: ${outcome.error.message}`,
        );

        return;
      case 'retry':
        throw outcome.error;
      default: {
        const unreachable: never = outcome;
        throw new Error(`Unknown delivery outcome ${JSON.stringify(unreachable)}`);
      }
    }
  }

  /** A row that is still pending but could not be claimed is held by another claim; retry, it may crash. */
  private async assertNoLongerPending(outboxId: string): Promise<void> {
    const current = await this.outbox.findById(outboxId);
    if (current !== null && current.sentAt === null && current.failedAt === null) {
      throw new NotificationBusyError(outboxId);
    }
  }

  /** A user's address and locale, or the stored address of an invitee without an account. */
  private resolveRecipient(claim: NotificationClaim): Recipient | null {
    const { notification } = claim;
    if (notification.recipientUserId !== null) {
      return claim.recipient;
    }
    if (notification.recipientEmail === null) {
      return null;
    }

    return {
      email: notification.recipientEmail,
      locale: notification.recipientLocale ?? DEFAULT_LOCALE,
      emailBouncing: false,
    };
  }

  private toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
  }

  private buildVariables(payload: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      result[k] = String(v ?? '');
    }

    return result;
  }
}
