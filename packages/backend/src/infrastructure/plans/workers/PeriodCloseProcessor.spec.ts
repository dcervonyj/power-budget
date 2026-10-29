import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { Job } from 'bullmq';
import { PeriodCloseUseCase } from '../../../application/plans/use-cases/PeriodCloseUseCase.js';
import { PeriodCloseProcessor, type PeriodCloseJobData } from './PeriodCloseProcessor.js';

function jobOf(data: PeriodCloseJobData): Job<PeriodCloseJobData> {
  const job = createMock<Job<PeriodCloseJobData>>();
  job.data = data;

  return job;
}

describe('PeriodCloseProcessor', () => {
  it('closes for the day carried in the job payload', async () => {
    const useCase = createMock<PeriodCloseUseCase>();
    useCase.execute.mockResolvedValue({ plansProcessed: 3 });
    const processor = new PeriodCloseProcessor(useCase);

    const result = await processor.process(jobOf({ day: '2026-10-21' }));

    expect(result).toEqual({ plansProcessed: 3 });
    expect(useCase.execute).toHaveBeenCalledTimes(1);
    expect(useCase.execute.mock.calls[0]?.[0]).toBe('2026-10-21');
  });

  it('falls back to the processing day for a job queued without a day', async () => {
    const useCase = createMock<PeriodCloseUseCase>();
    useCase.execute.mockResolvedValue({ plansProcessed: 0 });
    const processor = new PeriodCloseProcessor(useCase);

    await processor.process(jobOf({}));

    expect(useCase.execute.mock.calls[0]?.[0]).toBe(new Date().toISOString().slice(0, 10));
  });
});
