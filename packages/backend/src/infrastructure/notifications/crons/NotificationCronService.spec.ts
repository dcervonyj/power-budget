import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job, Queue } from 'bullmq';
import type { NotificationRepository } from '../../../domain/notifications/ports.js';
import type { NotificationOutbox } from '../../../domain/notifications/entities.js';
import {
  DEFAULT_DIGEST_TIME_ZONE,
  type RunWeeklyDigestUseCase,
} from '../../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import type { RunReconnectRemindersUseCase } from '../../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';
import type { DispatchNotificationJobPayload } from '../workers/DispatchNotificationProcessor.js';
import { NotificationCronService } from './NotificationCronService.js';

function makeService(pendingIds: string[]): {
  service: NotificationCronService;
  digest: ReturnType<typeof mock<RunWeeklyDigestUseCase>>;
  queue: ReturnType<typeof mock<Queue<DispatchNotificationJobPayload>>>;
} {
  const digest = mock<RunWeeklyDigestUseCase>();
  const reminders = mock<RunReconnectRemindersUseCase>();
  const repo = mock<NotificationRepository>();
  repo.findPendingBatch.mockResolvedValue(pendingIds.map((id) => mock<NotificationOutbox>({ id })));
  const queue = mock<Queue<DispatchNotificationJobPayload>>();
  queue.add.mockResolvedValue(mock<Job<DispatchNotificationJobPayload>>());

  return { service: new NotificationCronService(digest, reminders, repo, queue), digest, queue };
}

describe('NotificationCronService', () => {
  it('relays each pending outbox row once, under a BullMQ-valid job id', async () => {
    const { service, queue } = makeService(['n-1', 'n-2']);

    await service.relayOutbox();

    expect(queue.add.mock.calls).toEqual([
      [
        'dispatch',
        { outboxId: 'n-1' },
        { jobId: 'dispatch-n-1', removeOnComplete: true, removeOnFail: false },
      ],
      [
        'dispatch',
        { outboxId: 'n-2' },
        { jobId: 'dispatch-n-2', removeOnComplete: true, removeOnFail: false },
      ],
    ]);
  });

  it('runs the weekly digest in the Europe/Warsaw zone', async () => {
    const { service, digest } = makeService([]);

    await service.runWeeklyDigest();

    expect(digest.execute).toHaveBeenCalledTimes(1);
    expect(digest.execute.mock.calls[0]?.[1]).toBe(DEFAULT_DIGEST_TIME_ZONE);
  });
});
