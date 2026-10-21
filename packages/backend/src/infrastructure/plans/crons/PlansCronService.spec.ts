import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job, Queue } from 'bullmq';
import { PlansCronService } from './PlansCronService.js';

describe('PlansCronService', () => {
  it('enqueues one period-close job per UTC day with a BullMQ-valid job id', async () => {
    const queue = mock<Queue>();
    queue.add.mockResolvedValue(mock<Job>());
    const service = new PlansCronService(queue);

    await service.runPeriodClose(new Date('2026-10-21T00:30:00.000Z'));

    expect(queue.add).toHaveBeenCalledWith(
      'period-close',
      {},
      {
        jobId: 'period-close-2026-10-21',
        attempts: 5,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });
});
