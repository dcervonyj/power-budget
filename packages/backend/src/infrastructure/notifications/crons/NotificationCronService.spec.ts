import { NotificationEventId } from '@power-budget/core';
import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type {
  NotificationDispatchQueue,
  NotificationRepository,
} from '../../../domain/notifications/ports.js';
import type { NotificationOutboxRow } from '../../../domain/notifications/entities.js';
import {
  DEFAULT_DIGEST_TIME_ZONE,
  type RunWeeklyDigestUseCase,
} from '../../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import type { RunReconnectRemindersUseCase } from '../../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';
import { NotificationCronService } from './NotificationCronService.js';

function makeService(pendingIds: NotificationEventId[]): {
  service: NotificationCronService;
  digest: ReturnType<typeof createMock<RunWeeklyDigestUseCase>>;
  queue: ReturnType<typeof createMock<NotificationDispatchQueue>>;
} {
  const digest = createMock<RunWeeklyDigestUseCase>();
  digest.execute.mockResolvedValue({ skipped: [] });
  const reminders = createMock<RunReconnectRemindersUseCase>();
  const repo = createMock<NotificationRepository>();
  repo.findPendingBatch.mockResolvedValue(
    pendingIds.map((id) => createMock<NotificationOutboxRow>({ id })),
  );
  const queue = createMock<NotificationDispatchQueue>();
  queue.schedule.mockResolvedValue(undefined);

  return { service: new NotificationCronService(digest, reminders, repo, queue), digest, queue };
}

describe('NotificationCronService', () => {
  it('schedules each pending outbox row once', async () => {
    const { service, queue } = makeService([
      NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'),
      NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'),
    ]);

    await service.relayOutbox();

    expect(queue.schedule.mock.calls).toEqual([
      ['01900000-81f9-798c-8571-3fded10a77db'],
      ['01900000-5b16-7bff-801e-7f18bc3813b4'],
    ]);
  });

  it('keeps scheduling the remaining rows when one schedule fails', async () => {
    const { service, queue } = makeService([
      NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'),
      NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'),
      NotificationEventId.of('01900000-b506-7e80-8d33-5ecb613c3710'),
    ]);
    queue.schedule.mockRejectedValueOnce(new Error('Queue unavailable'));

    await expect(service.relayOutbox()).resolves.toBeUndefined();

    expect(queue.schedule.mock.calls).toEqual([
      ['01900000-81f9-798c-8571-3fded10a77db'],
      ['01900000-5b16-7bff-801e-7f18bc3813b4'],
      ['01900000-b506-7e80-8d33-5ecb613c3710'],
    ]);
  });

  it('runs the weekly digest in the Europe/Warsaw zone', async () => {
    const { service, digest } = makeService([]);

    await service.runWeeklyDigest();

    expect(digest.execute).toHaveBeenCalledTimes(1);
    expect(digest.execute.mock.calls[0]?.[0]).toBe(DEFAULT_DIGEST_TIME_ZONE);
  });
});
