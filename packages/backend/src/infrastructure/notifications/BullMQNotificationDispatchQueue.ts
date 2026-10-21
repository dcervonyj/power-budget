import type { JobsOptions, Queue } from 'bullmq';
import { MAX_DISPATCH_ATTEMPTS } from '../../domain/notifications/entities.js';
import type { NotificationDispatchQueue } from '../../domain/notifications/ports.js';

export interface DispatchNotificationJobPayload {
  readonly outboxId: string;
}

/** First retry after 30 s, then 60 s, 120 s, 240 s. */
export const DEFAULT_DISPATCH_BACKOFF_MS = 30_000;

/**
 * One BullMQ job per outbox row. The job id makes repeated schedules of a row
 * (API enqueue plus the relay cron) collapse into one job while it exists.
 */
export class BullMQNotificationDispatchQueue implements NotificationDispatchQueue {
  constructor(
    private readonly queue: Queue<DispatchNotificationJobPayload>,
    private readonly backoffDelayMs: number = DEFAULT_DISPATCH_BACKOFF_MS,
  ) {}

  async schedule(outboxId: string): Promise<void> {
    await this.queue.add('dispatch', { outboxId }, this.jobOptions(outboxId));
  }

  private jobOptions(outboxId: string): JobsOptions {
    return {
      // BullMQ rejects custom ids with a single ':'.
      jobId: `dispatch-${outboxId}`,
      attempts: MAX_DISPATCH_ATTEMPTS,
      backoff: { type: 'exponential', delay: this.backoffDelayMs },
      removeOnComplete: true,
      // The outbox row is the record of a failure; dropping the job lets the
      // relay cron schedule a still-pending row again.
      removeOnFail: true,
    };
  }
}
