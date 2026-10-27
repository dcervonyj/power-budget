import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { QUEUE_PERIOD_CLOSE } from '../../queue/queue.constants.js';

@Injectable()
export class PlansCronService {
  constructor(
    @InjectQueue(QUEUE_PERIOD_CLOSE)
    private readonly periodCloseQueue: Queue,
  ) {}

  /** Daily 00:30 UTC — trigger the period-close job for the day; it also catches up older unclosed plans */
  @Cron('30 0 * * *', { name: 'period-close', timeZone: 'UTC' })
  async runPeriodClose(now: Date = new Date()): Promise<void> {
    const day = now.toISOString().slice(0, 10);
    await this.periodCloseQueue.add(
      'period-close',
      { day },
      {
        // One job per UTC day; BullMQ rejects custom ids with a single ':'.
        jobId: `period-close-${day}`,
        // A failed plan fails the job; retries skip the plans already closed.
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
