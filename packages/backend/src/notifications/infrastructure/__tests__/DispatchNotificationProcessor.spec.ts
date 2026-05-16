import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job } from 'bullmq';
import type { HouseholdId, UserId } from '@power-budget/core';
import type {
  NotificationRepository,
  EmailChannel,
  TemplateRenderer,
} from '../../../domain/ports.js';
import type { NotificationOutbox } from '../../../domain/entities.js';
import {
  DispatchNotificationProcessor,
  type DispatchNotificationJobPayload,
} from '../workers/DispatchNotificationProcessor.js';

const TEST_USER_ID = 'user-1' as UserId;
const TEST_HOUSEHOLD_ID = 'hh-1' as HouseholdId;

function makeOutboxEntry(id: string): NotificationOutbox {
  return {
    id,
    householdId: TEST_HOUSEHOLD_ID,
    recipientUserId: TEST_USER_ID,
    kind: 'over_budget',
    dedupeKey: `over_budget:${id}`,
    payload: { name: 'Groceries', amount: '150.00', currency: 'PLN' },
    createdAt: new Date(),
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

describe('DispatchNotificationProcessor', () => {
  let notificationRepo: ReturnType<typeof mock<NotificationRepository>>;
  let emailChannel: ReturnType<typeof mock<EmailChannel>>;
  let templateRenderer: ReturnType<typeof mock<TemplateRenderer>>;
  let processor: DispatchNotificationProcessor;

  function makeJob(outboxId: string): Job<DispatchNotificationJobPayload> {
    return { data: { outboxId } } as Job<DispatchNotificationJobPayload>;
  }

  beforeEach(() => {
    notificationRepo = mock<NotificationRepository>();
    emailChannel = mock<EmailChannel>();
    templateRenderer = mock<TemplateRenderer>();
    processor = new DispatchNotificationProcessor(notificationRepo, emailChannel, templateRenderer);
  });

  it('processes a job by rendering template and dispatching via email channel', async () => {
    const entry = makeOutboxEntry('notif-1');
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findPendingBatch.mockResolvedValue([entry]);
    notificationRepo.findUserById.mockResolvedValue(MOCK_USER);
    templateRenderer.render.mockResolvedValue('<html>email</html>');
    emailChannel.send.mockResolvedValue(undefined);
    notificationRepo.markSent.mockResolvedValue(undefined);

    await processor.process(makeJob('notif-1'));

    expect(templateRenderer.render).toHaveBeenCalledWith('over_budget', 'en', expect.any(Object));
    expect(emailChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', html: '<html>email</html>' }),
    );
    expect(notificationRepo.markSent).toHaveBeenCalledWith('notif-1');
  });

  it('marks outbox entry as failed when email channel throws', async () => {
    const entry = makeOutboxEntry('notif-2');
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findPendingBatch.mockResolvedValue([entry]);
    notificationRepo.findUserById.mockResolvedValue(MOCK_USER);
    templateRenderer.render.mockResolvedValue('<html>email</html>');
    emailChannel.send.mockRejectedValue(new Error('SMTP error'));
    notificationRepo.markFailed.mockResolvedValue(undefined);

    await expect(processor.process(makeJob('notif-2'))).rejects.toThrow('SMTP error');
    expect(notificationRepo.markFailed).toHaveBeenCalledWith('notif-2');
  });

  it('marks as failed and returns early when user email is bouncing', async () => {
    const entry = makeOutboxEntry('notif-3');
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findPendingBatch.mockResolvedValue([entry]);
    notificationRepo.findUserById.mockResolvedValue({ ...MOCK_USER, emailBouncing: true });
    notificationRepo.markFailed.mockResolvedValue(undefined);

    await processor.process(makeJob('notif-3'));

    expect(emailChannel.send).not.toHaveBeenCalled();
    expect(notificationRepo.markFailed).toHaveBeenCalledWith('notif-3');
  });

  it('returns early without action when notification not found in pending batch', async () => {
    notificationRepo.incrementAttempts.mockResolvedValue(undefined);
    notificationRepo.findPendingBatch.mockResolvedValue([]);

    await processor.process(makeJob('notif-missing'));

    expect(emailChannel.send).not.toHaveBeenCalled();
    expect(notificationRepo.markSent).not.toHaveBeenCalled();
  });
});
