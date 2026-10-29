import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { Redis } from 'ioredis';
import type { BankCatalogEntry } from '../../domain/bank/entities.js';
import { RedisBankCatalogCache } from './RedisBankCatalogCache.js';

const ENTRIES: BankCatalogEntry[] = [
  { bankId: 'PKO_PLPKOPPLPW', name: 'PKO BP', countryCode: 'PL', logoUrl: null },
  { bankId: 'wise', name: 'Wise', countryCode: 'PL', logoUrl: 'https://wise.com/favicon.ico' },
];

describe('RedisBankCatalogCache', () => {
  let redis: ReturnType<typeof createMock<Redis>>;
  let cache: RedisBankCatalogCache;

  beforeEach(() => {
    redis = createMock<Redis>();
    cache = new RedisBankCatalogCache(redis);
  });

  it('stores the entries as JSON under the country with a TTL', async () => {
    await cache.set('PL', ENTRIES, 86_400);

    expect(redis.set).toHaveBeenCalledWith(
      'bank-catalogue:PL',
      JSON.stringify(ENTRIES),
      'EX',
      86_400,
    );
  });

  it('reads stored entries back', async () => {
    redis.get.mockResolvedValue(JSON.stringify(ENTRIES));

    expect(await cache.get('PL')).toEqual(ENTRIES);
    expect(redis.get).toHaveBeenCalledWith('bank-catalogue:PL');
  });

  it('reads a missing key as a miss', async () => {
    redis.get.mockResolvedValue(null);

    expect(await cache.get('PL')).toBeNull();
  });

  it('reads an entry that does not parse as a miss', async () => {
    redis.get.mockResolvedValueOnce('not json');
    redis.get.mockResolvedValueOnce('{"bankId":"x"}');
    redis.get.mockResolvedValueOnce('[{"bankId":"x","name":"X","countryCode":"PL","logoUrl":1}]');

    expect(await cache.get('PL')).toBeNull();
    expect(await cache.get('PL')).toBeNull();
    expect(await cache.get('PL')).toBeNull();
  });
});
