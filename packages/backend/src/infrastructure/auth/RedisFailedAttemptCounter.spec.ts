import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { Redis } from 'ioredis';
import { RedisFailedAttemptCounter } from './RedisFailedAttemptCounter.js';

describe('RedisFailedAttemptCounter', () => {
  let redis: ReturnType<typeof createMock<Redis>>;
  let counter: RedisFailedAttemptCounter;

  beforeEach(() => {
    redis = createMock<Redis>();
    counter = new RedisFailedAttemptCounter(redis);
  });

  it('counts with one script that opens the window on the first attempt', async () => {
    redis.eval.mockResolvedValue([3, 840]);

    const current = await counter.increment('totp-failures:u1', 900);

    expect(current).toEqual({ attempts: 3, secondsLeft: 840 });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('EXPIRE', KEYS[1], ARGV[1])"),
      1,
      'attempts:totp-failures:u1',
      900,
    );
  });

  it('never reports less than one second left', async () => {
    redis.eval.mockResolvedValue([6, 0]);

    const current = await counter.increment('totp-failures:u1', 900);

    expect(current).toEqual({ attempts: 6, secondsLeft: 1 });
  });

  it('reset deletes the counter', async () => {
    await counter.reset('totp-failures:u1');

    expect(redis.del).toHaveBeenCalledWith('attempts:totp-failures:u1');
  });

  it('fails loudly on an unexpected reply', async () => {
    redis.eval.mockResolvedValue('OK');

    await expect(counter.increment('k1', 900)).rejects.toThrow('unexpected script reply');
  });
});
