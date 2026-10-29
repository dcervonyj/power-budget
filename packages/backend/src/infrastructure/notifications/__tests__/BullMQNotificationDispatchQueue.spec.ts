import { NotificationEventId } from '@power-budget/core';
import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { Job, Queue } from 'bullmq';
import {
  BullMQNotificationDispatchQueue,
  type DispatchNotificationJobPayload,
} from '../BullMQNotificationDispatchQueue.js';
import { testUuid } from '../../../test/doubles/testUuid.js';

describe('BullMQNotificationDispatchQueue', () => {
  it('adds one retrying job per outbox row under a BullMQ-valid id', async () => {
    const queue = createMock<Queue<DispatchNotificationJobPayload>>();
    queue.add.mockResolvedValue(createMock<Job<DispatchNotificationJobPayload>>());

    await new BullMQNotificationDispatchQueue(queue).schedule(
      NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'),
    );

    expect(queue.add.mock.calls).toEqual([
      [
        'dispatch',
        { outboxId: '01900000-81f9-798c-8571-3fded10a77db' },
        {
          jobId: `dispatch-${testUuid('n-1')}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      ],
    ]);
  });
});
