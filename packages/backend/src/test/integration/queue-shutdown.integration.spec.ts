import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { startContainers, stopContainers } from './setup.js';
import { createTestApp } from './app.js';
import { WorkerModule } from '../../worker/worker.module.js';
import { ALL_QUEUES } from '../../infrastructure/queue/queue.constants.js';
import { getSharedQueueConnection } from '../../infrastructure/queue/redis-connection.js';

/** Records `<kind> closed` once per instance, when its first close() settles. */
function trace(proto: { close: () => Promise<void> }, kind: string, events: string[]): void {
  const original = proto.close;
  const seen = new WeakSet<object>();
  vi.spyOn(proto, 'close').mockImplementation(async function (this: object) {
    const first = !seen.has(this);
    seen.add(this);
    await original.call(this);
    if (first) {
      events.push(`${kind} closed`);
    }
  });
}

describe('shared queue Redis connection shutdown (CLN-056)', () => {
  let redisUrl: string;

  beforeAll(async () => {
    ({ redisUrl } = await startContainers());
    process.env['KEK_BASE64'] ??= Buffer.alloc(32).toString('base64');
    process.env['RESEND_API_KEY'] ??= 're_test_placeholder';
  });

  afterAll(async () => {
    await stopContainers();
  });

  it('closing the API and worker contexts quits each queue connection after queues and workers, with no closed-connection errors', async () => {
    const errors: string[] = [];
    const record = (...args: unknown[]): void => {
      errors.push(args.map(String).join(' '));
    };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(record);
    const loggerError = vi.spyOn(Logger.prototype, 'error').mockImplementation(record);
    const unhandled = (reason: unknown): void => record('unhandledRejection', reason);
    process.on('unhandledRejection', unhandled);

    const api: NestFastifyApplication = await createTestApp();
    const worker: INestApplicationContext = await NestFactory.createApplicationContext(
      WorkerModule,
      { logger: ['error'], abortOnError: false },
    );
    const shared = getSharedQueueConnection(redisUrl, 'worker');
    const apiShared = getSharedQueueConnection(redisUrl, 'api');
    await vi.waitFor(() => expect(shared.status).toBe('ready'));
    const events: string[] = [];
    const quit = vi.spyOn(shared, 'quit');
    quit.mockImplementation(async function (this: typeof shared) {
      events.push('quit');

      return Object.getPrototypeOf(shared).quit.call(this);
    });
    trace(Queue.prototype, 'queue', events);
    trace(Worker.prototype, 'worker', events);

    try {
      await api.close();
      // The API (bounded producer) connection is its own; the worker's stays up.
      await vi.waitFor(() => expect(apiShared.status).toBe('end'));
      expect(apiShared.options.maxRetriesPerRequest).toBe(2);
      expect(shared.options.maxRetriesPerRequest).toBeNull();
      expect(quit).not.toHaveBeenCalled();
      expect(shared.status).toBe('ready');

      await worker.close();
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(quit).toHaveBeenCalledTimes(1);
      expect(shared.status).toBe('end');
      // Every queue/worker close finished before the shared connection was quit.
      const quitAt = events.indexOf('quit');
      expect(quitAt).toBeGreaterThan(0);
      const beforeQuit = events.slice(0, quitAt);
      expect(beforeQuit.filter((event) => event === 'worker closed')).toHaveLength(3);
      expect(beforeQuit.filter((event) => event === 'queue closed').length).toBeGreaterThanOrEqual(
        ALL_QUEUES.length,
      );
      expect(errors.filter((line) => /closed|ECONNRESET|ERR_/i.test(line))).toEqual([]);
    } finally {
      process.off('unhandledRejection', unhandled);
      consoleError.mockRestore();
      loggerError.mockRestore();
    }
  });
});
