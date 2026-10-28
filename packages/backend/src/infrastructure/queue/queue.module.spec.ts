import 'reflect-metadata';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Logger } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { WorkerHost } from '@nestjs/bullmq';
import type { Queue, Worker } from 'bullmq';
import { parseAppConfig } from '../../config/AppConfig.js';
import { QueueModule } from './queue.module.js';
import {
  buildQueueConnectionOptions,
  getSharedQueueConnection,
  releaseSharedQueueConnection,
} from './redis-connection.js';

const config = parseAppConfig(
  {
    NODE_ENV: 'development',
    JWT_SECRET: 'unit-test-jwt-secret-with-at-least-32-bytes',
    KEK_BASE64: Buffer.alloc(32).toString('base64'),
    REDIS_URL: 'redis://localhost:6390',
  },
  'worker',
);

class FakeProcessor extends WorkerHost {
  constructor(worker: Worker) {
    super();
    Object.defineProperty(this, '_worker', { value: worker });
  }

  process(): Promise<void> {
    return Promise.resolve();
  }
}

function fakeWorker(name: string, close: () => Promise<void>): Worker {
  const worker = mock<Worker>();
  Object.defineProperty(worker, 'name', { value: name });
  worker.close.mockImplementation(close);

  return worker;
}

function buildModule(worker: Worker): QueueModule {
  const moduleRef = mock<ModuleRef>();
  moduleRef.get.mockImplementation(() => {
    const queue = mock<Queue>();
    queue.close.mockResolvedValue(undefined);

    return queue;
  });
  const discovery = mock<DiscoveryService>();
  discovery.getProviders.mockReturnValue([
    mock<ReturnType<DiscoveryService['getProviders']>[number]>({
      instance: new FakeProcessor(worker),
    }),
  ]);

  return new QueueModule(config, moduleRef, discovery);
}

describe('QueueModule shutdown', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await releaseSharedQueueConnection(config.redisUrl, config.role);
  });

  it('closes workers and queues, then quits the shared connection', async () => {
    buildQueueConnectionOptions(config);
    const quit = vi
      .spyOn(getSharedQueueConnection(config.redisUrl, config.role), 'quit')
      .mockResolvedValue('OK');
    const worker = fakeWorker('bank-sync', () => Promise.resolve());

    await buildModule(worker).onApplicationShutdown();

    expect(worker.close).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('logs a failed worker close, does not quit the connection and rejects', async () => {
    buildQueueConnectionOptions(config);
    const quit = vi
      .spyOn(getSharedQueueConnection(config.redisUrl, config.role), 'quit')
      .mockResolvedValue('OK');
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const worker = fakeWorker('bank-sync', () => Promise.reject(new Error('stalled')));

    await expect(buildModule(worker).onApplicationShutdown()).rejects.toThrow(
      '1 queue/worker close(s) failed',
    );

    expect(logged).toHaveBeenCalledWith('Closing "bank-sync" failed: Error: stalled');
    expect(quit).not.toHaveBeenCalled();
  });
});
