import 'reflect-metadata';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { Queue, Worker, type Job } from 'bullmq';
import { mock } from 'vitest-mock-extended';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { HouseholdId, UserId } from '@power-budget/core';
import { getDb, getPool, resetState, startContainers, stopContainers } from './setup.js';
import { insertTestHousehold, insertTestUser } from './test-helpers.js';
import * as schema from '../../../drizzle/schema.js';
import type { NotificationKind } from '../../domain/notifications/entities.js';
import type { EmailMessage } from '../../domain/notifications/ports.js';
import { DrizzleNotificationRepository } from '../../infrastructure/notifications/DrizzleNotificationRepository.js';
import { DrizzleNotificationOutbox } from '../../infrastructure/notifications/DrizzleNotificationOutbox.js';
import { UuidV7Generator } from '../../infrastructure/system/UuidV7Generator.js';
import { SystemClock } from '../../infrastructure/system/SystemClock.js';
import { MjmlTemplateRenderer } from '../../infrastructure/notifications/MjmlTemplateRenderer.js';
import {
  BullMQNotificationDispatchQueue,
  type DispatchNotificationJobPayload,
} from '../../infrastructure/notifications/BullMQNotificationDispatchQueue.js';
import {
  DispatchNotificationProcessor,
  NotificationBusyError,
} from '../../infrastructure/notifications/workers/DispatchNotificationProcessor.js';
import { InMemoryEmailChannel } from '../doubles/InMemoryEmailChannel.js';

const QUEUE_NAME = 'cln-009-notification-dispatch';
const TEMPLATE_DIR = join(__dirname, '../../infrastructure/notifications/templates');

/** Holds the first send open until released, to overlap two dispatchers. */
class GatedEmailChannel extends InMemoryEmailChannel {
  private releaseGate!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.releaseGate = resolve;
  });
  private inGate = 0;
  private readonly waiters: { count: number; resolve: () => void }[] = [];
  private enteredGate!: () => void;
  readonly entered = new Promise<void>((resolve) => {
    this.enteredGate = resolve;
  });

  release(): void {
    this.releaseGate();
  }

  /** Resolves once `count` sends are waiting at the gate. */
  entering(count: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waiters.push({ count, resolve });
      this.notifyWaiters();
    });
  }

  override async send(message: EmailMessage): Promise<void> {
    this.inGate += 1;
    this.notifyWaiters();
    this.enteredGate();
    await this.gate;
    await super.send(message);
  }

  private notifyWaiters(): void {
    for (const waiter of this.waiters) {
      if (this.inGate >= waiter.count) {
        waiter.resolve();
      }
    }
  }
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for the condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe('notification dispatch against real Postgres + Redis', () => {
  let redisUrl: string;
  let repo: DrizzleNotificationRepository;
  let queue: Queue<DispatchNotificationJobPayload>;
  let worker: Worker<DispatchNotificationJobPayload> | null;

  beforeAll(async () => {
    ({ redisUrl } = await startContainers());
  });

  afterAll(async () => {
    await stopContainers();
  });

  beforeEach(async () => {
    await resetState();
    repo = new DrizzleNotificationRepository(getDb());
    queue = new Queue(QUEUE_NAME, { connection: { url: redisUrl } });
    worker = null;
  });

  afterEach(async () => {
    await worker?.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  async function enqueue(
    userId: string,
    kind: NotificationKind,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const id = uuidv7();
    const outbox = new DrizzleNotificationOutbox(
      getDb(),
      { schedule: async () => undefined },
      { next: () => id },
      new SystemClock(),
    );
    await outbox.enqueue({
      recipientUserId: UserId.of(userId),
      kind,
      dedupeKey: `test:${id}`,
      payload,
    });

    return id;
  }

  function startWorker(email: InMemoryEmailChannel): void {
    const processor = new DispatchNotificationProcessor(
      repo,
      email,
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
    worker = new Worker<DispatchNotificationJobPayload>(
      QUEUE_NAME,
      (job) => processor.process(job),
      {
        connection: { url: redisUrl },
        concurrency: 5,
      },
    );
  }

  async function row(id: string): Promise<schema.SelectNotificationOutbox | undefined> {
    const [found] = await getDb()
      .select()
      .from(schema.notificationsOutbox)
      .where(eq(schema.notificationsOutbox.id, id));

    return found;
  }

  async function isSent(id: string): Promise<boolean> {
    return (await row(id))?.sentAt != null;
  }

  it('the outbox writes the row and schedules its dispatch once, even when enqueued twice', async () => {
    const ann = await insertTestUser(getDb(), { displayName: 'Ann' });
    const scheduled: string[] = [];
    const outbox = new DrizzleNotificationOutbox(
      getDb(),
      { schedule: async (id) => void scheduled.push(id) },
      new UuidV7Generator(),
      new SystemClock(),
    );
    const notification = {
      recipientUserId: UserId.of(ann.id),
      kind: 'over_budget' as const,
      dedupeKey: 'cln-067:same',
      payload: { name: 'Ann' },
    };

    await outbox.enqueue(notification);
    await outbox.enqueue(notification);

    const pending = await repo.findPendingBatch(10);
    expect(pending.map((n) => n.id)).toEqual(scheduled);
    expect(scheduled).toHaveLength(1);
  });

  it('the outbox writes an address-only invite row, deduplicates it and schedules it once', async () => {
    const household = await insertTestHousehold(getDb());
    const scheduled: string[] = [];
    const outbox = new DrizzleNotificationOutbox(
      getDb(),
      { schedule: async (id) => void scheduled.push(id) },
      new UuidV7Generator(),
      new SystemClock(),
    );
    const invite = {
      householdId: HouseholdId.of(household.id),
      email: 'Eve@Example.com',
      locale: 'uk' as const,
      kind: 'household_invite' as const,
      dedupeKey: 'cln-067:invite',
      payload: { inviterName: 'Ann' },
    };

    await outbox.enqueueToAddress(invite);
    await outbox.enqueueToAddress(invite);

    const [stored] = await repo.findPendingBatch(10);
    expect(stored).toMatchObject({
      householdId: household.id,
      recipientUserId: null,
      recipientEmail: 'eve@example.com',
      recipientLocale: 'uk',
      kind: 'household_invite',
      dedupeKey: 'cln-067:invite',
      payload: { inviterName: 'Ann' },
    });
    expect(await repo.findPendingBatch(10)).toHaveLength(1);
    expect(scheduled).toEqual([stored?.id]);
  });

  it('the outbox keeps the row when the dispatch queue is down (the relay cron picks it up)', async () => {
    const ann = await insertTestUser(getDb(), { displayName: 'Ann' });
    const outbox = new DrizzleNotificationOutbox(
      getDb(),
      {
        schedule: async () => {
          throw new Error('redis down');
        },
      },
      new UuidV7Generator(),
      new SystemClock(),
    );

    await outbox.enqueue({
      recipientUserId: UserId.of(ann.id),
      kind: 'over_budget',
      dedupeKey: 'cln-067:redis-down',
      payload: {},
    });

    expect(await repo.findPendingBatch(10)).toHaveLength(1);
  });

  it('sends two pending notifications once each, each to its own recipient', async () => {
    const ann = await insertTestUser(getDb(), { displayName: 'Ann' });
    const bob = await insertTestUser(getDb(), { displayName: 'Bob' });
    const first = await enqueue(ann.id, 'over_budget', { name: 'Ann', category: 'Food' });
    const second = await enqueue(bob.id, 'over_budget', { name: 'Bob', category: 'Rent' });
    const email = new InMemoryEmailChannel();
    const dispatch = new BullMQNotificationDispatchQueue(queue, 10);
    startWorker(email);

    // Scheduled twice each (API enqueue plus relay cron): still one job per row.
    await dispatch.schedule(first);
    await dispatch.schedule(second);
    await dispatch.schedule(first);
    await dispatch.schedule(second);
    await waitFor(async () => (await isSent(first)) && (await isSent(second)));

    expect(email.sent.map((sent) => sent.to).sort()).toEqual([ann.email, bob.email].sort());
    expect(email.calls).toHaveLength(2);
    expect((await row(first))?.attempts).toBe(1);
    expect((await row(second))?.attempts).toBe(1);
  });

  it('a retry after a send whose acknowledgement was lost does not deliver twice', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'magic_link', {
      link: 'https://power-budget.pages.dev/auth/magic-link?token=secret',
    });
    const email = new InMemoryEmailChannel();
    // Attempt 1: the provider accepts the email, then the worker sees a timeout.
    email.loseNextAcknowledgements(1);
    startWorker(email);

    await new BullMQNotificationDispatchQueue(queue, 10).schedule(id);
    await waitFor(() => isSent(id));

    expect(email.calls.map((call) => call.idempotencyKey)).toEqual([
      `notification-${id}`,
      `notification-${id}`,
    ]);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.html).toContain('token=secret');
    const stored = await row(id);
    expect(stored?.attempts).toBe(2);
    // The raw sign-in token does not stay in the outbox once sent.
    expect(stored?.payload).toEqual({});
  });

  it('holds no connection while the email is being sent', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'over_budget', { name: 'Ann' });
    const email = new GatedEmailChannel();
    const processor = new DispatchNotificationProcessor(
      repo,
      email,
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
    const job = mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId: id } });

    const run = processor.process(job);
    await email.entered;
    const pool = getPool();
    expect(pool.totalCount - pool.idleCount).toBe(0);
    email.release();
    await run;

    expect(await isSent(id)).toBe(true);
  });

  it('5 concurrent jobs use at most 5 connections', async () => {
    const ann = await insertTestUser(getDb());
    const ids = await Promise.all(
      Array.from({ length: 5 }, () => enqueue(ann.id, 'over_budget', { name: 'Ann' })),
    );
    const email = new GatedEmailChannel();
    const processor = new DispatchNotificationProcessor(
      repo,
      email,
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
    const runs = ids.map((outboxId) =>
      processor.process(mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId } })),
    );

    await email.entering(5);
    const pool = getPool();
    expect(pool.totalCount - pool.idleCount).toBeLessThanOrEqual(5);
    email.release();
    await Promise.all(runs);

    expect(pool.totalCount).toBeLessThanOrEqual(5);
    expect((await Promise.all(ids.map((id) => isSent(id)))).every(Boolean)).toBe(true);
  });

  it('a duplicate job after the first committed is a no-op', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'over_budget', { name: 'Ann' });
    const email = new InMemoryEmailChannel();
    const processor = new DispatchNotificationProcessor(
      repo,
      email,
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
    const job = mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId: id } });

    await processor.process(job);
    await processor.process(job);

    expect(email.calls).toHaveLength(1);
    expect(await isSent(id)).toBe(true);
  });

  it('a late failed mark cannot overwrite a sent row', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'over_budget', { name: 'Ann' });
    const first = await repo.claimForDispatch(id);
    const second = await repo.claimForDispatch(id);

    await first?.markSent();
    await second?.markFailed();

    const stored = await row(id);
    expect(stored?.sentAt).not.toBeNull();
    expect(stored?.failedAt).toBeNull();
  });

  it('a delivered send is recorded sent when a later attempt failed the row first', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'over_budget', { name: 'Ann' });
    const earlier = await repo.claimForDispatch(id);
    const later = await repo.claimForDispatch(id);

    await later?.markFailed();
    await earlier?.markSent();

    const stored = await row(id);
    expect(stored?.sentAt).not.toBeNull();
    expect(stored?.failedAt).toBeNull();
  });

  it('an earlier attempt cannot fail a row a later attempt has claimed', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'over_budget', { name: 'Ann' });
    const earlier = await repo.claimForDispatch(id);
    await repo.claimForDispatch(id);

    await earlier?.markFailed();

    const stored = await row(id);
    expect(stored?.failedAt).toBeNull();
    expect(stored?.sentAt).toBeNull();
  });

  it('throws NotificationBusyError while another claim holds the row', async () => {
    const ann = await insertTestUser(getDb());
    const id = await enqueue(ann.id, 'over_budget', { name: 'Ann' });
    const processor = new DispatchNotificationProcessor(
      repo,
      new InMemoryEmailChannel(),
      new MjmlTemplateRenderer(TEMPLATE_DIR),
    );
    const holder = await getPool().connect();
    await holder.query('BEGIN');
    await holder.query('SELECT id FROM notifications_outbox WHERE id = $1 FOR UPDATE', [id]);

    try {
      await expect(
        processor.process(mock<Job<DispatchNotificationJobPayload>>({ data: { outboxId: id } })),
      ).rejects.toBeInstanceOf(NotificationBusyError);
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
  });
});
