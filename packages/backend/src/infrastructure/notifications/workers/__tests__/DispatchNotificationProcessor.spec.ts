import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { Job } from 'bullmq';
import { NotificationEventId, UserId } from '@power-budget/core';
import type { TemplateRenderer } from '../../../../domain/notifications/ports.js';
import { MAX_DISPATCH_ATTEMPTS } from '../../../../domain/notifications/entities.js';
import { InMemoryNotificationRepository } from '../../../../test/doubles/InMemoryNotificationRepository.js';
import { InMemoryEmailChannel } from '../../../../test/doubles/InMemoryEmailChannel.js';
import type { DispatchNotificationJobPayload } from '../../BullMQNotificationDispatchQueue.js';
import { DispatchNotificationProcessor } from '../DispatchNotificationProcessor.js';
import { testUuid } from '../../../../test/doubles/testUuid.js';

const ANN = UserId.of('01900000-0000-7000-8000-0000000000a1');
const BOB = UserId.of('01900000-0000-7000-8000-0000000000b1');

class KindRenderer implements TemplateRenderer {
  async render(kind: string, locale: string, variables: Record<string, string>): Promise<string> {
    return `<p>${kind}.${locale}:${JSON.stringify(variables)}</p>`;
  }
}

function jobFor(outboxId: NotificationEventId): Job<DispatchNotificationJobPayload> {
  return createMock<Job<DispatchNotificationJobPayload>>({ data: { outboxId } });
}

describe('DispatchNotificationProcessor', () => {
  let outbox: InMemoryNotificationRepository;
  let email: InMemoryEmailChannel;
  let processor: DispatchNotificationProcessor;

  beforeEach(async () => {
    const queuedIds = [
      NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'),
      NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'),
    ];
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
    await processor.process(jobFor(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4')));

    expect(email.sent).toEqual([
      {
        to: 'bob@example.com',
        subject: 'Your sign-in link — Power Budget',
        html: '<p>magic_link.en:{"link":"https://app.example/auth/magic-link?token=abc"}</p>',
        idempotencyKey: `notification-${testUuid('n-2')}`,
      },
    ]);
    expect(
      (await outbox.findById(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')))
        ?.sentAt,
    ).toBeNull();
    expect(
      (await outbox.findById(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4')))
        ?.sentAt,
    ).toBeInstanceOf(Date);
  });

  it('sends two pending rows once each', async () => {
    await Promise.all([
      processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'))),
      processor.process(jobFor(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'))),
    ]);
    await processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')));

    expect(email.calls.map((call) => call.idempotencyKey).sort()).toEqual(
      [`notification-${testUuid('n-1')}`, `notification-${testUuid('n-2')}`].sort(),
    );
  });

  it('scrubs the sign-in link from the payload once sent', async () => {
    await processor.process(jobFor(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4')));

    expect(
      (await outbox.findById(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4')))
        ?.payload,
    ).toEqual({});
  });

  it('sends an address-only invite in its stored locale and scrubs the link (CLN-006)', async () => {
    outbox.seedAddressRow({
      id: NotificationEventId.of('01900000-b506-7e80-8d33-5ecb613c3710'),
      kind: 'household_invite',
      dedupeKey: 'k-3',
      email: 'eve@example.com',
      locale: 'uk',
      payload: { link: 'https://app.example/invite/accept?token=xyz', inviterName: 'Ann' },
    });

    await processor.process(jobFor(NotificationEventId.of('01900000-b506-7e80-8d33-5ecb613c3710')));

    expect(email.sent).toEqual([
      {
        to: 'eve@example.com',
        subject: 'You are invited to a household — Power Budget',
        html: '<p>household_invite.uk:{"link":"https://app.example/invite/accept?token=xyz","inviterName":"Ann"}</p>',
        idempotencyKey: `notification-${testUuid('n-3')}`,
      },
    ]);
    expect(
      (await outbox.findById(NotificationEventId.of('01900000-b506-7e80-8d33-5ecb613c3710')))
        ?.payload,
    ).toEqual({
      inviterName: 'Ann',
    });
  });

  it('defaults an address-only row without a locale to English', async () => {
    outbox.seedAddressRow({
      id: NotificationEventId.of('01900000-b771-7ba2-87cc-f77baa39ca50'),
      kind: 'household_invite',
      dedupeKey: 'k-4',
      email: 'eve@example.com',
      locale: null,
      payload: {},
    });

    await processor.process(jobFor(NotificationEventId.of('01900000-b771-7ba2-87cc-f77baa39ca50')));

    expect(email.sent[0]?.html).toBe('<p>household_invite.en:{}</p>');
  });

  it('drops a row that has neither a user nor an address', async () => {
    outbox.seedAddressRow({
      id: NotificationEventId.of('01900000-1c4c-74fa-805b-ac4cdc64c10e'),
      kind: 'household_invite',
      dedupeKey: 'k-5',
      email: null,
      locale: null,
      payload: {},
    });

    await processor.process(jobFor(NotificationEventId.of('01900000-1c4c-74fa-805b-ac4cdc64c10e')));

    expect(email.calls).toEqual([]);
    expect(
      (await outbox.findById(NotificationEventId.of('01900000-1c4c-74fa-805b-ac4cdc64c10e')))
        ?.failedAt,
    ).toBeInstanceOf(Date);
  });

  it('rethrows a send error so BullMQ retries, and keeps the row pending', async () => {
    email.failNext(1);

    await expect(
      processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'))),
    ).rejects.toThrow('Email provider unavailable');

    const row = await outbox.findById(
      NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'),
    );
    expect(row?.attempts).toBe(1);
    expect(row?.sentAt).toBeNull();
    expect(row?.failedAt).toBeNull();
  });

  it('a retry after a lost acknowledgement reuses the idempotency key (one delivery)', async () => {
    email.loseNextAcknowledgements(1);

    await expect(
      processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db'))),
    ).rejects.toThrow('ETIMEDOUT');
    await processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')));

    expect(email.calls.map((call) => call.idempotencyKey)).toEqual([
      `notification-${testUuid('n-1')}`,
      `notification-${testUuid('n-1')}`,
    ]);
    expect(email.sent).toHaveLength(1);
    expect(
      (await outbox.findById(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')))
        ?.attempts,
    ).toBe(2);
  });

  it(`marks the row failed after ${MAX_DISPATCH_ATTEMPTS} failed attempts and stops retrying`, async () => {
    email.failNext(MAX_DISPATCH_ATTEMPTS);

    for (let attempt = 1; attempt < MAX_DISPATCH_ATTEMPTS; attempt++) {
      await expect(
        processor.process(jobFor(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'))),
      ).rejects.toThrow();
    }
    await expect(
      processor.process(jobFor(NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'))),
    ).resolves.toBeUndefined();

    const row = await outbox.findById(
      NotificationEventId.of('01900000-5b16-7bff-801e-7f18bc3813b4'),
    );
    expect(row?.failedAt).toBeInstanceOf(Date);
    expect(row?.attempts).toBe(MAX_DISPATCH_ATTEMPTS);
    expect(row?.payload).toEqual({});
    expect(email.sent).toEqual([]);
  });

  it('drops a row whose recipient bounces, without sending', async () => {
    await outbox.setEmailBouncing('ann@example.com');

    await processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')));

    expect(email.calls).toEqual([]);
    expect(
      (await outbox.findById(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')))
        ?.failedAt,
    ).toBeInstanceOf(Date);
  });

  it('does nothing for a row that is already sent or unknown', async () => {
    await processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')));
    await processor.process(jobFor(NotificationEventId.of('01900000-81f9-798c-8571-3fded10a77db')));
    await processor.process(jobFor(NotificationEventId.of('01900000-5a01-73c4-8950-8291c6816ac3')));

    expect(email.calls).toHaveLength(1);
  });
});
