import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { NotificationRepository, EmailChannel, TemplateRenderer } from '../../domain/ports.js';
import { QUEUE_OUTBOX_RELAY } from '../../../shared/infrastructure/queue/queue.constants.js';
import { SUBJECT_BY_KIND } from './DispatchNotificationProcessor.js';

export interface OutboxRelayJobPayload {
  readonly batchSize?: number;
}

export interface OutboxRelayResult {
  readonly processed: number;
  readonly failed: number;
}

@Processor(QUEUE_OUTBOX_RELAY, { concurrency: 1 })
export class OutboxRelayProcessor extends WorkerHost {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly emailChannel: EmailChannel,
    private readonly templateRenderer: TemplateRenderer,
  ) {
    super();
  }

  async process(job: Job<OutboxRelayJobPayload>): Promise<OutboxRelayResult> {
    const batch = await this.notificationRepo.findPendingBatch(job.data.batchSize ?? 50);

    let processed = 0;
    let failed = 0;

    for (const notification of batch) {
      try {
        await this.notificationRepo.incrementAttempts(notification.id);

        const user = await this.notificationRepo.findUserById(notification.recipientUserId);
        if (user === null || user.emailBouncing) {
          await this.notificationRepo.markFailed(notification.id);
          failed++;
          continue;
        }

        const variables = this.buildVariables(notification.payload);
        const html = await this.templateRenderer.render(notification.kind, user.locale, variables);
        const subject = SUBJECT_BY_KIND[notification.kind] ?? 'Notification — Power Budget';

        await this.emailChannel.send({ to: user.email, subject, html });
        await this.notificationRepo.markSent(notification.id);
        processed++;
      } catch (err) {
        console.error(
          `[OutboxRelayProcessor] Failed to process notification ${notification.id}: ${(err as Error).message}`,
        );
        await this.notificationRepo.markFailed(notification.id).catch(() => undefined);
        failed++;
      }
    }

    return { processed, failed };
  }

  private buildVariables(payload: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      result[k] = String(v ?? '');
    }
    return result;
  }
}
