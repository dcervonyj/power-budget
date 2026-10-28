import { describe, it, expect, afterEach } from 'vitest';
import { parseAppConfig } from '../../config/AppConfig.js';
import { Redis } from 'ioredis';
import { buildQueueConnectionOptions } from './redis-connection.js';

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
  afterEach(() => {
    while (clients.length > 0) {
      clients.pop()?.disconnect();
    }
  });

  it('passes the full REDIS_URL through instead of rebuilding host/port', () => {
    const options = buildQueueConnectionOptions(
      parseAppConfig({ ...BASE_ENV, REDIS_URL: UPSTASH_URL }, 'api'),
    );

    expect(options).toEqual({ connection: { url: UPSTASH_URL } });
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

    expect(options).toEqual({ connection: { url: 'redis://localhost:6379' } });
  });
});
