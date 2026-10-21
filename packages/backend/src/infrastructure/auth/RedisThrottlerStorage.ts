import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * Fixed-window counter plus block key, in one Lua script so concurrent
 * requests (and several API instances) share one exact count (audit H4).
 * KEYS[1] hit counter, KEYS[2] block flag; ARGV ttl ms, limit, block ms.
 * Returns {hits, counterPttl, blocked (0|1), blockPttl}.
 */
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
  return {hits, redis.call('PTTL', KEYS[1]), 1, blockTtl}
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return {hits, ttl, 1, tonumber(ARGV[3])}
end
return {hits, ttl, 0, 0}
`;

const KEY_PREFIX = 'throttle:';

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `${KEY_PREFIX}${throttlerName}:${key}`;
    const reply = await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      counterKey,
      `${counterKey}:blocked`,
      ttl,
      limit,
      blockDuration,
    );
    const [hits, counterPttl, blocked, blockPttl] = toNumbers(reply);

    return {
      totalHits: hits,
      timeToExpire: toSeconds(counterPttl),
      isBlocked: blocked === 1,
      timeToBlockExpire: toSeconds(blockPttl),
    };
  }
}

function toNumbers(reply: unknown): [number, number, number, number] {
  if (!Array.isArray(reply) || reply.length !== 4) {
    throw new Error('RedisThrottlerStorage: unexpected script reply');
  }

  return [Number(reply[0]), Number(reply[1]), Number(reply[2]), Number(reply[3])];
}

function toSeconds(milliseconds: number): number {
  return milliseconds > 0 ? Math.ceil(milliseconds / 1000) : 0;
}
