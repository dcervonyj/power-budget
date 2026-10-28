import { Redis } from 'ioredis';
import type { AppConfig } from '../../config/AppConfig.js';
import type { QueueOptions } from 'bullmq';

type QueueRole = AppConfig['role'];

const sharedConnections = new Map<string, Redis>();
/** Nest contexts currently holding each shared connection. */
const holders = new Map<string, number>();

/** Command retries before a producer call fails; a Redis outage must not hang API requests. */
const PRODUCER_MAX_RETRIES_PER_REQUEST = 2;

function keyOf(url: string, role: QueueRole): string {
  return `${role}|${url}`;
}

/**
 * One ioredis connection per role and REDIS_URL for the BullMQ queues of a Nest context
 * (CLN-056 / PERF-18). Before, each of the 5 queues opened its own connection per context.
 * The two roles differ in retry policy:
 * - `api` is a producer only (no processors): `maxRetriesPerRequest` is bounded, so an enqueue
 *   during a Redis outage fails fast instead of waiting forever.
 * - `worker` runs the processors: BullMQ requires `maxRetriesPerRequest: null` (retry forever)
 *   for worker connections. Workers still duplicate it once for their blocking calls.
 *
 * The full REDIS_URL is handed to ioredis as-is, so `rediss://` keeps TLS and the
 * `user:password@` part keeps the ACL username (Upstash needs both); the db index in the
 * path is kept too.
 */
export function getSharedQueueConnection(url: string, role: QueueRole): Redis {
  const key = keyOf(url, role);
  const existing = sharedConnections.get(key);
  if (existing !== undefined && existing.status !== 'end') {
    return existing;
  }
  const connection = new Redis(url, {
    maxRetriesPerRequest: role === 'worker' ? null : PRODUCER_MAX_RETRIES_PER_REQUEST,
  });
  // An unhandled 'error' event would crash the process; ioredis keeps reconnecting.
  connection.on('error', (err: Error) => {
    console.error(`Queue Redis connection error: ${err.message}`);
  });
  sharedConnections.set(key, connection);

  return connection;
}

/**
 * Called once per Nest context on shutdown: the last holder of the (role, url) connection
 * quits it. In production the only caller is QueueModule.onApplicationShutdown.
 */
export async function releaseSharedQueueConnection(url: string, role: QueueRole): Promise<void> {
  const key = keyOf(url, role);
  const remaining = (holders.get(key) ?? 0) - 1;
  if (remaining > 0) {
    holders.set(key, remaining);

    return;
  }
  holders.delete(key);
  const connection = sharedConnections.get(key);
  sharedConnections.delete(key);
  await connection?.quit().catch(() => undefined);
}

export function buildQueueConnectionOptions(
  config: Pick<AppConfig, 'redisUrl' | 'role'>,
): Pick<QueueOptions, 'connection'> {
  const key = keyOf(config.redisUrl, config.role);
  holders.set(key, (holders.get(key) ?? 0) + 1);

  return { connection: getSharedQueueConnection(config.redisUrl, config.role) };
}
