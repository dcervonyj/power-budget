import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { IsoDate } from '@power-budget/core';
import { QUEUE_PERIOD_CLOSE, WORKER_DRAIN_DELAY_SECONDS } from '../../queue/queue.constants.js';
import {
  PeriodCloseUseCase,
  type PeriodCloseResult,
} from '../../../application/plans/use-cases/PeriodCloseUseCase.js';

export interface PeriodCloseJobData {
  /** UTC day (YYYY-MM-DD) the cron fired for. */
  readonly day?: string;
}

@Processor(QUEUE_PERIOD_CLOSE, {
  concurrency: 1,
  drainDelay: WORKER_DRAIN_DELAY_SECONDS,
})
export class PeriodCloseProcessor extends WorkerHost {
  constructor(private readonly periodCloseUseCase: PeriodCloseUseCase) {
    super();
  }

  async process(job: Job<PeriodCloseJobData>): Promise<PeriodCloseResult> {
    const now = new Date();

    return this.periodCloseUseCase.execute(this.dayOf(job.data, now), now);
  }

  /** The job's own day; a job queued without one falls back to the processing day. */
  private dayOf(data: PeriodCloseJobData, now: Date): IsoDate {
    const day = typeof data.day === 'string' ? data.day : now.toISOString().slice(0, 10);

    return IsoDate.of(day);
  }
}
