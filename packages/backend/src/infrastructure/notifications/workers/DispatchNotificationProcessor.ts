import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type {
  NotificationRepository,
  EmailChannel,
  TemplateRenderer,
} from '../../../domain/notifications/ports.js';
import { QUEUE_NOTIFICATION_DISPATCH } from '../../queue/queue.constants.js';

export interface DispatchNotificationJobPayload {
  readonly outboxId: string;
}

const SUBJECT_BY_KIND: Record<string, string> = {
  over_budget: 'Over Budget Alert — Power Budget',
  weekly_digest: 'Your Weekly Budget Summary — Power Budget',
  reconnect_reminder: 'Bank Connection Expiring — Power Budget',
};

export { SUBJECT_BY_KIND };

@Processor(QUEUE_NOTIFICATION_DISPATCH, { concurrency: 5 })
export class DispatchNotificationProcessor extends WorkerHost {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly emailChannel: EmailChannel,
    private readonly templateRenderer: TemplateRenderer,
  ) {
    super();
  }

  async process(job: Job<DispatchNotificationJobPayload>): Promise<void> {
    const { outboxId } = job.data;

    await this.notificationRepo.incrementAttempts(outboxId);

    const batch = await this.notificationRepo.findPendingBatch(1);
    const notification = batch.find((n) => n.id === outboxId);

    if (notification === undefined) {
      // Already sent or failed by another worker
      return;
    }

    const user = await this.notificationRepo.findUserById(notification.recipientUserId);
    if (user === null || user.emailBouncing) {
      await this.notificationRepo.markFailed(outboxId);
      return;
    }

    try {
      const variables = this.buildVariables(notification.payload);
      const html = await this.templateRenderer.render(notification.kind, user.locale, variables);
      const subject = SUBJECT_BY_KIND[notification.kind] ?? 'Notification — Power Budget';

      await this.emailChannel.send({
        to: user.email,
        subject,
        html,
      });

      await this.notificationRepo.markSent(outboxId);
    } catch (err) {
      await this.notificationRepo.markFailed(outboxId);
      throw err;
    }
  }

  private buildVariables(payload: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      result[k] = String(v ?? '');
    }
    return result;
  }
}
