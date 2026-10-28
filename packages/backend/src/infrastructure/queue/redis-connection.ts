import type { AppConfig } from '../../config/AppConfig.js';
import type { QueueOptions } from 'bullmq';

/**
 * BullMQ connection built from the full REDIS_URL. The URL is handed to ioredis
 * as-is, so `rediss://` keeps TLS and the `user:password@` part keeps the ACL
 * username (Upstash needs both); the db index in the path is kept too.
 */
export function buildQueueConnectionOptions(
  config: Pick<AppConfig, 'redisUrl'>,
): Pick<QueueOptions, 'connection'> {
  return { connection: { url: config.redisUrl } };
}
