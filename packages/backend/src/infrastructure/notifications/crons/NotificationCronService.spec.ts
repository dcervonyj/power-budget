import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  NotificationDispatchQueue,
  NotificationRepository,
} from '../../../domain/notifications/ports.js';
import type { NotificationOutbox } from '../../../domain/notifications/entities.js';
import {
  DEFAULT_DIGEST_TIME_ZONE,
  type RunWeeklyDigestUseCase,
} from '../../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import type { RunReconnectRemindersUseCase } from '../../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';
import { NotificationCronService } from './NotificationCronService.js';

function makeService(pendingIds: string[]): {
  service: NotificationCronService;
  digest: ReturnType<typeof mock<RunWeeklyDigestUseCase>>;
  queue: ReturnType<typeof mock<NotificationDispatchQueue>>;
} {
  const digest = mock<RunWeeklyDigestUseCase>();
  digest.execute.mockResolvedValue({ skipped: [] });
  const reminders = mock<RunReconnectRemindersUseCase>();
  const repo = mock<NotificationRepository>();
  repo.findPendingBatch.mockResolvedValue(pendingIds.map((id) => mock<NotificationOutbox>({ id })));
  const queue = mock<NotificationDispatchQueue>();
  queue.schedule.mockResolvedValue(undefined);

  return { service: new NotificationCronService(digest, reminders, repo, queue), digest, queue };
}

describe('NotificationCronService', () => {
  it('schedules each pending outbox row once', async () => {
    const { service, queue } = makeService(['n-1', 'n-2']);

    await service.relayOutbox();

    expect(queue.schedule.mock.calls).toEqual([['n-1'], ['n-2']]);
  });

  it('keeps scheduling the remaining rows when one schedule fails', async () => {
    const { service, queue } = makeService(['n-1', 'n-2', 'n-3']);
    queue.schedule.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect(service.relayOutbox()).resolves.toBeUndefined();

    expect(queue.schedule.mock.calls).toEqual([['n-1'], ['n-2'], ['n-3']]);
  });

  it('runs the weekly digest in the Europe/Warsaw zone', async () => {
    const { service, digest } = makeService([]);

    await service.runWeeklyDigest();

    expect(digest.execute).toHaveBeenCalledTimes(1);
    expect(digest.execute.mock.calls[0]?.[1]).toBe(DEFAULT_DIGEST_TIME_ZONE);
  });
});
