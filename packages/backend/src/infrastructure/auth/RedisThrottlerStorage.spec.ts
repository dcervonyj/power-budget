import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Redis } from 'ioredis';
import { RedisThrottlerStorage } from './RedisThrottlerStorage.js';

describe('RedisThrottlerStorage', () => {
  let redis: ReturnType<typeof mock<Redis>>;
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    redis = mock<Redis>();
    storage = new RedisThrottlerStorage(redis);
  });

  it('runs one script per hit with the counter and block keys', async () => {
    redis.eval.mockResolvedValue([3, 59_001, 0, 0]);

    const record = await storage.increment('k1', 60_000, 20, 60_000, 'ip');

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      2,
      'throttle:ip:k1',
      'throttle:ip:k1:blocked',
      60_000,
      20,
      60_000,
    );
  });

  it('reports a blocked key with the block time left in seconds', async () => {
    redis.eval.mockResolvedValue([21, 30_000, 1, 1_500]);

    const record = await storage.increment('k1', 60_000, 20, 60_000, 'ip');

    expect(record).toEqual({
      totalHits: 21,
      timeToExpire: 30,
      isBlocked: true,
      timeToBlockExpire: 2,
    });
  });

  it('fails loudly on an unexpected reply', async () => {
    redis.eval.mockResolvedValue('OK');

    await expect(storage.increment('k1', 60_000, 20, 60_000, 'ip')).rejects.toThrow(
      'unexpected script reply',
    );
  });
});
