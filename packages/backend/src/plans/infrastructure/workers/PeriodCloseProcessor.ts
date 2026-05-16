import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { QUEUE_PERIOD_CLOSE } from '../../../shared/infrastructure/queue/queue.constants.js';
import {
  PeriodCloseUseCase,
  type PeriodCloseResult,
} from '../../application/use-cases/PeriodCloseUseCase.js';

@Processor(QUEUE_PERIOD_CLOSE, { concurrency: 1 })
export class PeriodCloseProcessor extends WorkerHost {
  constructor(private readonly periodCloseUseCase: PeriodCloseUseCase) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_job: Job): Promise<PeriodCloseResult> {
    return this.periodCloseUseCase.execute(new Date());
  }
}
