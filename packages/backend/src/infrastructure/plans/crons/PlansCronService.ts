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
  @Cron('30 0 * * *', { timeZone: 'UTC' })
  async runPeriodClose(): Promise<void> {
    await this.periodCloseQueue.add(
      'period-close',
      {},
      {
        jobId: `period-close:${new Date().toISOString().slice(0, 10)}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
