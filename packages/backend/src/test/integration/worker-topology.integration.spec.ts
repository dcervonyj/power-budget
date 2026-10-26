import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import { startContainers, stopContainers } from './setup.js';
import { createTestApp } from './app.js';
import { WorkerModule } from '../../worker/worker.module.js';
import { BullMQBankSyncQueue } from '../../infrastructure/bank/BullMQBankSyncQueue.js';

const CONNECTION_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b' as BankConnectionId;
const HOUSEHOLD_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c' as HouseholdId;

describe('worker topology against real Redis + Postgres', () => {
  let redisUrl: string;

  beforeAll(async () => {
    ({ redisUrl } = await startContainers());
    // Same placeholders createTestApp() sets; the worker reads them at boot.
    process.env['KEK_BASE64'] ??= Buffer.alloc(32).toString('base64');
    process.env['RESEND_API_KEY'] ??= 're_test_placeholder';
  });

  afterAll(async () => {
    await stopContainers();
  });

  it('the booted worker registers each cron exactly once', async () => {
    const worker: INestApplicationContext = await NestFactory.createApplicationContext(
      WorkerModule,
      { logger: ['error'], abortOnError: false },
    );
    try {
      const cronNames = [...worker.get(SchedulerRegistry).getCronJobs().keys()].sort();

      expect(cronNames).toEqual([
        'bank-sync-schedule',
        'fx-daily-ingest',
        'household-purge',
        'outbox-relay',
        'period-close',
        'reconnect-reminders',
        'weekly-digest',
      ]);
    } finally {
      await worker.close();
    }
  });

  it('the booted API has queues (producers) but no scheduler at all', async () => {
    const api: NestFastifyApplication = await createTestApp();
    try {
      // get(SchedulerRegistry) would make Nest exit the process, so inspect the module graph.
      const modules = [...api.get(ModulesContainer).values()].map(
        (moduleRef) => moduleRef.metatype,
      );

      expect(modules).not.toContain(ScheduleModule);
      expect(modules).toContain(BullModule);
    } finally {
      await api.close();
    }
  });

  it('repeated bank-sync enqueues for one connection do not stack', async () => {
    // Not a consumed queue name, so nothing drains the jobs while we count them.
    const queue = new Queue('cln-010-bank-sync-dedupe', { connection: { url: redisUrl } });
    try {
      const syncQueue = new BullMQBankSyncQueue(queue);
      const scheduledAt = new Date('2026-10-21T08:00:00.000Z');
      const target = { connectionId: CONNECTION_ID, householdId: HOUSEHOLD_ID };

      await syncQueue.enqueue({ ...target, scheduledAt });
      await syncQueue.enqueue({ ...target, scheduledAt });
      await syncQueue.enqueue(target);
      await syncQueue.enqueue(target);

      expect(await queue.getWaitingCount()).toBe(1);
      expect((await queue.getWaiting()).map((job) => job.id)).toEqual([
        `bank-sync-${CONNECTION_ID}-20261021T0800`,
      ]);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });

  it('BullMQ accepts the cron job ids (a single ":" is rejected)', async () => {
    const queue = new Queue('cln-010-job-ids', { connection: { url: redisUrl } });
    try {
      await expect(
        queue.add('dispatch', {}, { jobId: `dispatch-${CONNECTION_ID}` }),
      ).resolves.toBeDefined();
      await expect(
        queue.add('period-close', {}, { jobId: 'period-close-2026-10-21' }),
      ).resolves.toBeDefined();
      await expect(
        queue.add('dispatch', {}, { jobId: `dispatch:${CONNECTION_ID}` }),
      ).rejects.toThrow('Custom Id cannot contain :');
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
  });
});
