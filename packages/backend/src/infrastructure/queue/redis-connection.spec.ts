import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseAppConfig } from '../../config/AppConfig.js';
import { Redis } from 'ioredis';
import {
  buildQueueConnectionOptions,
  closeSharedQueueConnections,
  getSharedQueueConnection,
  releaseSharedQueueConnection,
} from './redis-connection.js';

const UPSTASH_URL = 'rediss://default:s3cret@eu1-example-12345.upstash.io:6379';

const BASE_ENV = {
  NODE_ENV: 'development',
  JWT_SECRET: 'unit-test-jwt-secret-with-at-least-32-bytes',
  KEK_BASE64: Buffer.alloc(32).toString('base64'),
};

const clients: Redis[] = [];

/** What ioredis (and so BullMQ, which calls `new IORedis(url, rest)`) makes of the options. */
function parsedByIoredis(url: string): Redis {
  const client = new Redis(url, { lazyConnect: true });
  clients.push(client);

  return client;
}

describe('buildQueueConnectionOptions', () => {
  afterEach(async () => {
    await closeSharedQueueConnections();
    while (clients.length > 0) {
      clients.pop()?.disconnect();
    }
  });

  it('hands BullMQ one shared ioredis connection built from the full REDIS_URL', () => {
    const options = buildQueueConnectionOptions(
      parseAppConfig({ ...BASE_ENV, REDIS_URL: UPSTASH_URL }, 'api'),
    );

    expect(options.connection).toBeInstanceOf(Redis);
    expect(options.connection).toBe(getSharedQueueConnection(UPSTASH_URL));
    expect(getSharedQueueConnection(UPSTASH_URL).options.maxRetriesPerRequest).toBeNull();
    expect(getSharedQueueConnection(UPSTASH_URL).options.tls).toBeDefined();
  });

  it('returns the same connection for repeated builds (API and worker contexts share it)', () => {
    const config = parseAppConfig({ ...BASE_ENV, REDIS_URL: UPSTASH_URL }, 'api');

    expect(buildQueueConnectionOptions(config).connection).toBe(
      buildQueueConnectionOptions(config).connection,
    );
  });

  it('keeps TLS, username and password of a rediss:// (Upstash) URL', () => {
    const client = parsedByIoredis(UPSTASH_URL);

    expect(client.options.tls).toBeDefined();
    expect(client.options.username).toBe('default');
    expect(client.options.password).toBe('s3cret');
    expect(client.options.host).toBe('eu1-example-12345.upstash.io');
    expect(client.options.port).toBe(6379);
  });

  it('keeps plain redis:// without TLS and keeps the db index', () => {
    const client = parsedByIoredis('redis://localhost:6380/2');

    expect(client.options.tls).toBeUndefined();
    expect(client.options.port).toBe(6380);
    expect(client.options.db).toBe(2);
  });

  it('falls back to local Redis when REDIS_URL is unset', () => {
    const options = buildQueueConnectionOptions(parseAppConfig(BASE_ENV, 'api'));

    expect(options.connection).toBe(getSharedQueueConnection('redis://localhost:6379'));
  });
});

describe('releaseSharedQueueConnection', () => {
  afterEach(async () => {
    await closeSharedQueueConnections();
  });

  it('quits the shared connection exactly once, when the last context releases it', async () => {
    const config = parseAppConfig(BASE_ENV, 'api');
    buildQueueConnectionOptions(config); // API context
    buildQueueConnectionOptions(config); // embedded worker context
    const connection = getSharedQueueConnection(config.redisUrl);
    const quit = vi.spyOn(connection, 'quit').mockResolvedValue('OK');

    await releaseSharedQueueConnection(config.redisUrl);
    expect(quit).not.toHaveBeenCalled();

    await releaseSharedQueueConnection(config.redisUrl);
    expect(quit).toHaveBeenCalledTimes(1);

    connection.disconnect();
  });
});
