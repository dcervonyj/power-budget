import type { ConfigService } from '@nestjs/config';
import type { QueueOptions } from 'bullmq';

export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/**
 * BullMQ connection built from the full REDIS_URL. The URL is handed to ioredis
 * as-is, so `rediss://` keeps TLS and the `user:password@` part keeps the ACL
 * username (Upstash needs both); the db index in the path is kept too.
 */
export function buildQueueConnectionOptions(
  config: ConfigService,
): Pick<QueueOptions, 'connection'> {
  const url = config.get<string>('REDIS_URL') ?? DEFAULT_REDIS_URL;

  return { connection: { url } };
}
