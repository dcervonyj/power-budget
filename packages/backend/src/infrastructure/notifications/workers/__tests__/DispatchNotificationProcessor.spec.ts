import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Job } from 'bullmq';
import type { NotificationEventId, UserId } from '@power-budget/core';
import type { TemplateRenderer } from '../../../../domain/notifications/ports.js';
import { MAX_DISPATCH_ATTEMPTS } from '../../../../domain/notifications/entities.js';
import { InMemoryNotificationRepository } from '../../../../test/doubles/InMemoryNotificationRepository.js';
import { InMemoryEmailChannel } from '../../../../test/doubles/InMemoryEmailChannel.js';
import type { DispatchNotificationJobPayload } from '../../BullMQNotificationDispatchQueue.js';
import { DispatchNotificationProcessor } from '../DispatchNotificationProcessor.js';

const ANN = '01900000-0000-7000-8000-0000000000a1' as UserId;
const BOB = '01900000-0000-7000-8000-0000000000b1' as UserId;

class KindRenderer implements TemplateRenderer {
  async render(kind: string, locale: string, variables: Record<string, string>): Promise<string> {
    return `<p>${kind}.${locale}:${JSON.stringify(variables)}</p>`;
  }
}

function jobFor(outboxId: NotificationEventId): Job<DispatchNotificationJobPayload> {
  return mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId } });
}

describe('DispatchNotificationProcessor', () => {
  let outbox: InMemoryNotificationRepository;
  let email: InMemoryEmailChannel;
  let processor: DispatchNotificationProcessor;

  beforeEach(async () => {
    const queuedIds = ['n-1' as NotificationEventId, 'n-2' as NotificationEventId];
    outbox = new InMemoryNotificationRepository({ next: () => queuedIds.shift() ?? 'n-extra' });
    email = new InMemoryEmailChannel();
    processor = new DispatchNotificationProcessor(outbox, email, new KindRenderer());
    outbox.addUser(ANN, { email: 'ann@example.com', displayName: 'Ann', locale: 'pl' });
    outbox.addUser(BOB, { email: 'bob@example.com', displayName: 'Bob', locale: 'en' });
    await outbox.enqueue({
      recipientUserId: ANN,
      kind: 'over_budget',
      dedupeKey: 'k-1',
      payload: { name: 'Ann' },
    });
    await outbox.enqueue({
      recipientUserId: BOB,
      kind: 'magic_link',
      dedupeKey: 'k-2',
      payload: { link: 'https://app.example/auth/magic-link?token=abc' },
    });
  });

  it('sends the job own row, not the oldest pending one', async () => {
    await processor.process(jobFor('n-2' as NotificationEventId));

    expect(email.sent).toEqual([
      {
        to: 'bob@example.com',
        subject: 'Your sign-in link — Power Budget',
        html: '<p>magic_link.en:{"link":"https://app.example/auth/magic-link?token=abc"}</p>',
        idempotencyKey: 'notification-n-2',
      },
    ]);
    expect((await outbox.findById('n-1' as NotificationEventId))?.sentAt).toBeNull();
    expect((await outbox.findById('n-2' as NotificationEventId))?.sentAt).toBeInstanceOf(Date);
  });

  it('sends two pending rows once each', async () => {
    await Promise.all([
      processor.process(jobFor('n-1' as NotificationEventId)),
      processor.process(jobFor('n-2' as NotificationEventId)),
    ]);
    await processor.process(jobFor('n-1' as NotificationEventId));

    expect(email.calls.map((call) => call.idempotencyKey).sort()).toEqual([
      'notification-n-1',
      'notification-n-2',
    ]);
  });

  it('scrubs the sign-in link from the payload once sent', async () => {
    await processor.process(jobFor('n-2' as NotificationEventId));

    expect((await outbox.findById('n-2' as NotificationEventId))?.payload).toEqual({});
  });

  it('sends an address-only invite in its stored locale and scrubs the link (CLN-006)', async () => {
    outbox.seedAddressRow({
      id: 'n-3' as NotificationEventId,
      kind: 'household_invite',
      dedupeKey: 'k-3',
      email: 'eve@example.com',
      locale: 'uk',
      payload: { link: 'https://app.example/invite/accept?token=xyz', inviterName: 'Ann' },
    });

    await processor.process(jobFor('n-3' as NotificationEventId));

    expect(email.sent).toEqual([
      {
        to: 'eve@example.com',
        subject: 'You are invited to a household — Power Budget',
        html: '<p>household_invite.uk:{"link":"https://app.example/invite/accept?token=xyz","inviterName":"Ann"}</p>',
        idempotencyKey: 'notification-n-3',
      },
    ]);
    expect((await outbox.findById('n-3' as NotificationEventId))?.payload).toEqual({
      inviterName: 'Ann',
    });
  });

  it('defaults an address-only row without a locale to English', async () => {
    outbox.seedAddressRow({
      id: 'n-4' as NotificationEventId,
      kind: 'household_invite',
      dedupeKey: 'k-4',
      email: 'eve@example.com',
      locale: null,
      payload: {},
    });

    await processor.process(jobFor('n-4' as NotificationEventId));

    expect(email.sent[0]?.html).toBe('<p>household_invite.en:{}</p>');
  });

  it('drops a row that has neither a user nor an address', async () => {
    outbox.seedAddressRow({
      id: 'n-5' as NotificationEventId,
      kind: 'household_invite',
      dedupeKey: 'k-5',
      email: null,
      locale: null,
      payload: {},
    });

    await processor.process(jobFor('n-5' as NotificationEventId));

    expect(email.calls).toEqual([]);
    expect((await outbox.findById('n-5' as NotificationEventId))?.failedAt).toBeInstanceOf(Date);
  });

  it('rethrows a send error so BullMQ retries, and keeps the row pending', async () => {
    email.failNext(1);

    await expect(processor.process(jobFor('n-1' as NotificationEventId))).rejects.toThrow(
      'Email provider unavailable',
    );

    const row = await outbox.findById('n-1' as NotificationEventId);
    expect(row?.attempts).toBe(1);
    expect(row?.sentAt).toBeNull();
    expect(row?.failedAt).toBeNull();
  });

  it('a retry after a lost acknowledgement reuses the idempotency key (one delivery)', async () => {
    email.loseNextAcknowledgements(1);

    await expect(processor.process(jobFor('n-1' as NotificationEventId))).rejects.toThrow(
      'ETIMEDOUT',
    );
    await processor.process(jobFor('n-1' as NotificationEventId));

    expect(email.calls.map((call) => call.idempotencyKey)).toEqual([
      'notification-n-1',
      'notification-n-1',
    ]);
    expect(email.sent).toHaveLength(1);
    expect((await outbox.findById('n-1' as NotificationEventId))?.attempts).toBe(2);
  });

  it(`marks the row failed after ${MAX_DISPATCH_ATTEMPTS} failed attempts and stops retrying`, async () => {
    email.failNext(MAX_DISPATCH_ATTEMPTS);

    for (let attempt = 1; attempt < MAX_DISPATCH_ATTEMPTS; attempt++) {
      await expect(processor.process(jobFor('n-2' as NotificationEventId))).rejects.toThrow();
    }
    await expect(processor.process(jobFor('n-2' as NotificationEventId))).resolves.toBeUndefined();

    const row = await outbox.findById('n-2' as NotificationEventId);
    expect(row?.failedAt).toBeInstanceOf(Date);
    expect(row?.attempts).toBe(MAX_DISPATCH_ATTEMPTS);
    expect(row?.payload).toEqual({});
    expect(email.sent).toEqual([]);
  });

  it('drops a row whose recipient bounces, without sending', async () => {
    await outbox.setEmailBouncing('ann@example.com');

    await processor.process(jobFor('n-1' as NotificationEventId));

    expect(email.calls).toEqual([]);
    expect((await outbox.findById('n-1' as NotificationEventId))?.failedAt).toBeInstanceOf(Date);
  });

  it('does nothing for a row that is already sent or unknown', async () => {
    await processor.process(jobFor('n-1' as NotificationEventId));
    await processor.process(jobFor('n-1' as NotificationEventId));
    await processor.process(jobFor('missing' as NotificationEventId));

    expect(email.calls).toHaveLength(1);
  });
});
