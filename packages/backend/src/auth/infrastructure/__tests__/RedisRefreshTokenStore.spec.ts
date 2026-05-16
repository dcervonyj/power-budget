import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Redis } from 'ioredis';
import type { UserId } from '@power-budget/core';
import { RedisRefreshTokenStore } from '../RedisRefreshTokenStore.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

describe('RedisRefreshTokenStore', () => {
  let redis: ReturnType<typeof mock<Redis>>;
  let store: RedisRefreshTokenStore;

  beforeEach(() => {
    redis = mock<Redis>();
    store = new RedisRefreshTokenStore(redis);
  });

  it('issue saves token hash with userId and TTL', async () => {
    redis.set.mockResolvedValue('OK');

    const token = await store.issue(TEST_USER_ID, 3600);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:/),
      TEST_USER_ID,
      'EX',
      3600,
    );
  });

  it('rotate returns new token and userId for valid old token', async () => {
    redis.set.mockResolvedValue('OK');
    const oldToken = await store.issue(TEST_USER_ID, 3600);

    redis.get.mockResolvedValue(TEST_USER_ID);
    redis.del.mockResolvedValue(1);

    const result = await store.rotate(oldToken);

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(TEST_USER_ID);
    expect(typeof result!.newToken).toBe('string');
    expect(result!.newToken).not.toBe(oldToken);
  });

  it('rotate returns null when token does not exist in Redis', async () => {
    redis.get.mockResolvedValue(null);

    const result = await store.rotate('non-existent-token');

    expect(result).toBeNull();
  });

  it('revoke deletes the token key from Redis', async () => {
    redis.set.mockResolvedValue('OK');
    const token = await store.issue(TEST_USER_ID, 3600);
    redis.del.mockResolvedValue(1);

    await store.revoke(token);

    expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^refresh:/));
  });
});
