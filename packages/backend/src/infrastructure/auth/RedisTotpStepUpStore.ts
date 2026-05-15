import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { UserId } from '@power-budget/core';
import type { TotpStepUpStore } from '../../domain/auth/ports.js';
import { REDIS_CLIENT } from './RedisRefreshTokenStore.js';

@Injectable()
export class RedisTotpStepUpStore implements TotpStepUpStore {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ttlSeconds = 300, // 5 minutes
  ) {
    this.ttlSeconds = ttlSeconds;
  }

  async stamp(userId: UserId): Promise<void> {
    await this.redis.set(`totp-stepup:${userId}`, '1', 'EX', this.ttlSeconds);
  }

  async isRecent(userId: UserId): Promise<boolean> {
    const val = await this.redis.get(`totp-stepup:${userId}`);

    return val !== null;
  }
}
