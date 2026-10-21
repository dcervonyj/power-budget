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

  /** Daily 00:30 UTC — trigger period-close job for all plans ending yesterday */
  @Cron('30 0 * * *', { name: 'period-close', timeZone: 'UTC' })
  async runPeriodClose(now: Date = new Date()): Promise<void> {
    await this.periodCloseQueue.add(
      'period-close',
      {},
      {
        // One job per UTC day; BullMQ rejects custom ids with a single ':'.
        jobId: `period-close-${now.toISOString().slice(0, 10)}`,
        // A failed plan fails the job; retries skip the plans already closed.
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
