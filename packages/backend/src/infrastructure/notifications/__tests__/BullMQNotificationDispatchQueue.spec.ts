import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job, Queue } from 'bullmq';
import {
  BullMQNotificationDispatchQueue,
  type DispatchNotificationJobPayload,
} from '../BullMQNotificationDispatchQueue.js';

describe('BullMQNotificationDispatchQueue', () => {
  it('adds one retrying job per outbox row under a BullMQ-valid id', async () => {
    const queue = mock<Queue<DispatchNotificationJobPayload>>();
    queue.add.mockResolvedValue(mock<Job<DispatchNotificationJobPayload>>());

    await new BullMQNotificationDispatchQueue(queue).schedule('n-1');

    expect(queue.add.mock.calls).toEqual([
      [
        'dispatch',
        { outboxId: 'n-1' },
        {
          jobId: 'dispatch-n-1',
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      ],
    ]);
  });
});
