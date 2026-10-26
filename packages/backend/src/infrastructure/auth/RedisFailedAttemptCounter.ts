import { Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { AttemptWindow, FailedAttemptCounter } from '../../domain/auth/ports.js';
import { REDIS_CLIENT } from './RedisRefreshTokenStore.js';

/**
 * INCR plus the window TTL on the first attempt, in one Lua script so
 * concurrent requests on any API instance share one exact count (CLN-031).
 * KEYS[1] counter; ARGV[1] window in seconds. Returns {attempts, ttlSeconds}.
 */
const INCREMENT_SCRIPT = `
local attempts = redis.call('INCR', KEYS[1])
if attempts == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {attempts, redis.call('TTL', KEYS[1])}
`;

const KEY_PREFIX = 'attempts:';

export class RedisFailedAttemptCounter implements FailedAttemptCounter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async increment(key: string, windowSeconds: number): Promise<AttemptWindow> {
    const reply = await this.redis.eval(INCREMENT_SCRIPT, 1, prefixed(key), windowSeconds);
    const [attempts, ttlSeconds] = toNumbers(reply);

    return { attempts, secondsLeft: Math.max(ttlSeconds, 1) };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(prefixed(key));
  }
}

function prefixed(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

function toNumbers(reply: unknown): [number, number] {
  if (!Array.isArray(reply) || reply.length !== 2) {
    throw new Error('RedisFailedAttemptCounter: unexpected script reply');
  }

  return [Number(reply[0]), Number(reply[1])];
}
