import { Redis } from 'ioredis';
import type { AppConfig } from '../../config/AppConfig.js';
import type { QueueOptions } from 'bullmq';

const sharedConnections = new Map<string, Redis>();

/**
 * One ioredis connection per REDIS_URL for every BullMQ queue in the process (the API and the
 * embedded worker context share it; CLN-056 / PERF-18). Before, each of the 5 queues opened
 * its own connection per Nest context. Workers still duplicate it once for their blocking
 * calls (BullMQ requirement), so a worker never blocks the shared connection.
 *
 * The full REDIS_URL is handed to ioredis as-is, so `rediss://` keeps TLS and the
 * `user:password@` part keeps the ACL username (Upstash needs both); the db index in the
 * path is kept too. `maxRetriesPerRequest: null` is required by BullMQ for worker connections.
 */
export function getSharedQueueConnection(url: string): Redis {
  const existing = sharedConnections.get(url);
  if (existing !== undefined && existing.status !== 'end') {
    return existing;
  }
  const connection = new Redis(url, { maxRetriesPerRequest: null });
  // An unhandled 'error' event would crash the process; ioredis keeps reconnecting.
  connection.on('error', (err: Error) => {
    console.error(`Queue Redis connection error: ${err.message}`);
  });
  sharedConnections.set(url, connection);

  return connection;
}

/** Closes the shared connections (graceful shutdown in tests). */
export async function closeSharedQueueConnections(): Promise<void> {
  const open = [...sharedConnections.values()];
  sharedConnections.clear();
  await Promise.all(open.map((connection) => connection.quit().catch(() => undefined)));
}

export function buildQueueConnectionOptions(
  config: Pick<AppConfig, 'redisUrl'>,
): Pick<QueueOptions, 'connection'> {
  return { connection: getSharedQueueConnection(config.redisUrl) };
}
