import { describe, it, expect } from 'vitest';
import { Queue } from 'bullmq';
import { boundedEnqueue, QueueUnavailableError } from './bounded-enqueue.js';
import { getSharedQueueConnection, releaseSharedQueueConnection } from './redis-connection.js';

const UNREACHABLE_REDIS = 'redis://127.0.0.1:1';

describe('boundedEnqueue', () => {
  it('passes the result of a fast enqueue through', async () => {
    await expect(boundedEnqueue(Promise.resolve('job-1'), 'sync', 50)).resolves.toBe('job-1');
  });

  it('passes the failure of the enqueue through', async () => {
    await expect(boundedEnqueue(Promise.reject(new Error('boom')), 'sync', 50)).rejects.toThrow(
      'boom',
    );
  });

  it('rejects within the bound for a promise that never settles', async () => {
    await expect(boundedEnqueue(new Promise<never>(() => undefined), 'sync', 50)).rejects.toThrow(
      QueueUnavailableError,
    );
  });

  it('rejects an enqueue on the API connection while Redis is unreachable (down at startup)', async () => {
    const connection = getSharedQueueConnection(UNREACHABLE_REDIS, 'api');
    const queue = new Queue('cln-056-unreachable', { connection });
    queue.on('error', () => undefined);
    const startedAt = Date.now();

    try {
      await expect(boundedEnqueue(queue.add('x', {}), 'x job', 300)).rejects.toThrow(
        'Queue unavailable: x job not accepted by Redis within 300 ms',
      );
      expect(Date.now() - startedAt).toBeLessThan(2_000);
    } finally {
      connection.disconnect();
      await releaseSharedQueueConnection(UNREACHABLE_REDIS, 'api');
    }
  });
});
