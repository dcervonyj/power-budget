import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job } from 'bullmq';
import type { UserId, HouseholdId } from '@power-budget/core';
import type {
  NotificationRepository,
  EmailChannel,
  TemplateRenderer,
} from '../../../../domain/notifications/ports.js';
import type {
  NotificationOutbox,
  NotificationKind,
} from '../../../../domain/notifications/entities.js';
import { OutboxRelayProcessor } from '../OutboxRelayProcessor.js';

function makeNotification(id: string, kind: NotificationKind = 'over_budget'): NotificationOutbox {
  return {
    id,
    householdId: 'hh-1' as HouseholdId,
    recipientUserId: 'user-1' as UserId,
    kind,
    dedupeKey: `${kind}:${id}`,
    payload: { name: 'Groceries', amount: '150.00', currency: 'PLN' },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    sentAt: null,
    failedAt: null,
    attempts: 0,
  };
}

const MOCK_USER = {
  email: 'user@example.com',
  displayName: 'Test User',
  locale: 'en',
  emailBouncing: false,
};

describe('OutboxRelayProcessor', () => {
  let notificationRepo: ReturnType<typeof mock<NotificationRepository>>;
  let emailChannel: ReturnType<typeof mock<EmailChannel>>;
  let templateRenderer: ReturnType<typeof mock<TemplateRenderer>>;
  let processor: OutboxRelayProcessor;

  beforeEach(() => {
    notificationRepo = mock<NotificationRepository>();
    emailChannel = mock<EmailChannel>();
    templateRenderer = mock<TemplateRenderer>();
    processor = new OutboxRelayProcessor(notificationRepo, emailChannel, templateRenderer);
  });

  function makeJob(batchSize?: number): Job<{ batchSize?: number }> {
    return { data: { batchSize } } as Job<{ batchSize?: number }>;
  }

  it('processes a pending batch and calls markSent on success', async () => {
    const notifications = [makeNotification('n-1'), makeNotification('n-2')];
    notificationRepo.findPendingBatch.mockResolvedValue(notifications);
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findUserById.mockResolvedValue(MOCK_USER);
    templateRenderer.render.mockResolvedValue('<p>Hello</p>');
    emailChannel.send.mockResolvedValue(undefined);
    notificationRepo.markSent.mockResolvedValue(undefined);

    const result = await processor.process(makeJob(10));

    expect(result).toEqual({ processed: 2, failed: 0 });
    expect(notificationRepo.incrementAttempts).toHaveBeenCalledWith('n-1');
    expect(notificationRepo.incrementAttempts).toHaveBeenCalledWith('n-2');
    expect(notificationRepo.markSent).toHaveBeenCalledWith('n-1');
    expect(notificationRepo.markSent).toHaveBeenCalledWith('n-2');
    expect(notificationRepo.markFailed).not.toHaveBeenCalled();
  });

  it('calls markFailed when user is not found', async () => {
    const notifications = [makeNotification('n-1')];
    notificationRepo.findPendingBatch.mockResolvedValue(notifications);
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findUserById.mockResolvedValue(null);
    notificationRepo.markFailed.mockResolvedValue(undefined);

    const result = await processor.process(makeJob());

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(notificationRepo.markFailed).toHaveBeenCalledWith('n-1');
    expect(notificationRepo.markSent).not.toHaveBeenCalled();
  });

  it('calls markFailed when user email is bouncing', async () => {
    const notifications = [makeNotification('n-1')];
    notificationRepo.findPendingBatch.mockResolvedValue(notifications);
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findUserById.mockResolvedValue({ ...MOCK_USER, emailBouncing: true });
    notificationRepo.markFailed.mockResolvedValue(undefined);

    const result = await processor.process(makeJob());

    expect(result).toEqual({ processed: 0, failed: 1 });
    expect(notificationRepo.markFailed).toHaveBeenCalledWith('n-1');
  });

  it('continues processing remaining notifications when a single notification fails', async () => {
    const notifications = [makeNotification('n-1'), makeNotification('n-2')];
    notificationRepo.findPendingBatch.mockResolvedValue(notifications);
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findUserById.mockResolvedValue(MOCK_USER);
    templateRenderer.render
      .mockRejectedValueOnce(new Error('template error'))
      .mockResolvedValueOnce('<p>Hello</p>');
    emailChannel.send.mockResolvedValue(undefined);
    notificationRepo.markSent.mockResolvedValue(undefined);
    notificationRepo.markFailed.mockResolvedValue(undefined);

    const result = await processor.process(makeJob());

    expect(result).toEqual({ processed: 1, failed: 1 });
    expect(notificationRepo.markFailed).toHaveBeenCalledWith('n-1');
    expect(notificationRepo.markSent).toHaveBeenCalledWith('n-2');
  });

  it('uses default batch size of 50 when no batchSize provided', async () => {
    notificationRepo.findPendingBatch.mockResolvedValue([]);

    await processor.process(makeJob(undefined));

    expect(notificationRepo.findPendingBatch).toHaveBeenCalledWith(50);
  });

  it('returns zero counts when batch is empty', async () => {
    notificationRepo.findPendingBatch.mockResolvedValue([]);

    const result = await processor.process(makeJob());

    expect(result).toEqual({ processed: 0, failed: 0 });
  });
});
