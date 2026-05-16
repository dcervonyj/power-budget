import { createHash, randomBytes } from 'node:crypto';
import { Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { UserId } from '@power-budget/core';
import type { RefreshTokenStore } from '../domain/ports.js';

export const REDIS_CLIENT = 'REDIS_CLIENT';

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export class RedisRefreshTokenStore implements RefreshTokenStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async issue(userId: UserId, ttlSeconds: number): Promise<string> {
    const token = generateToken();
    const key = `refresh:${hash(token)}`;
    await this.redis.set(key, userId, 'EX', ttlSeconds);
    return token;
  }

  async rotate(oldToken: string): Promise<{ userId: UserId; newToken: string } | null> {
    const oldKey = `refresh:${hash(oldToken)}`;
    const userId = await this.redis.get(oldKey);
    if (!userId) return null;

    await this.redis.del(oldKey);

    const ttl = 60 * 60 * 24 * 30; // 30 days
    const newToken = generateToken();
    const newKey = `refresh:${hash(newToken)}`;
    await this.redis.set(newKey, userId, 'EX', ttl);

    return { userId: userId as UserId, newToken };
  }

  async revoke(token: string): Promise<void> {
    const key = `refresh:${hash(token)}`;
    await this.redis.del(key);
  }
}
