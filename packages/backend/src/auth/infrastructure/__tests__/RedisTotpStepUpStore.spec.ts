import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Redis } from 'ioredis';
import type { UserId } from '@power-budget/core';
import { RedisTotpStepUpStore } from '../RedisTotpStepUpStore.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

describe('RedisTotpStepUpStore', () => {
  let redis: ReturnType<typeof mock<Redis>>;
  let store: RedisTotpStepUpStore;

  beforeEach(() => {
    redis = mock<Redis>();
    store = new RedisTotpStepUpStore(redis);
  });

  it('stamp stores key with 5-minute TTL (300 seconds)', async () => {
    redis.set.mockResolvedValue('OK');

    await store.stamp(TEST_USER_ID);

    expect(redis.set).toHaveBeenCalledWith(`totp-stepup:${TEST_USER_ID}`, '1', 'EX', 300);
  });

  it('isRecent returns true when key exists in Redis', async () => {
    redis.get.mockResolvedValue('1');

    const result = await store.isRecent(TEST_USER_ID);

    expect(result).toBe(true);
    expect(redis.get).toHaveBeenCalledWith(`totp-stepup:${TEST_USER_ID}`);
  });

  it('isRecent returns false when key is absent', async () => {
    redis.get.mockResolvedValue(null);

    const result = await store.isRecent(TEST_USER_ID);

    expect(result).toBe(false);
  });

  it('stamp uses custom TTL when provided', async () => {
    redis.set.mockResolvedValue('OK');
    const customStore = new RedisTotpStepUpStore(redis, 60);

    await customStore.stamp(TEST_USER_ID);

    expect(redis.set).toHaveBeenCalledWith(`totp-stepup:${TEST_USER_ID}`, '1', 'EX', 60);
  });
});
