import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { BankCatalogEntry, CountryCode } from '../../domain/bank/entities.js';
import type { BankCatalogCache } from '../../domain/bank/ports.js';
import { REDIS_CLIENT } from '../auth/RedisRefreshTokenStore.js';

const KEY_PREFIX = 'bank-catalogue:';

/**
 * The bank catalogue per country as JSON in Redis with a TTL (CLN-033), shared by every API
 * instance so the provider is asked about once per country per TTL. An entry that does not
 * parse reads as a miss and is overwritten by the next fetch.
 */
@Injectable()
export class RedisBankCatalogCache implements BankCatalogCache {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get(country: CountryCode): Promise<BankCatalogEntry[] | null> {
    const raw = await this.redis.get(this.keyOf(country));
    if (raw === null) {
      return null;
    }

    return this.parse(raw);
  }

  async set(
    country: CountryCode,
    entries: readonly BankCatalogEntry[],
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(this.keyOf(country), JSON.stringify(entries), 'EX', ttlSeconds);
  }

  private keyOf(country: CountryCode): string {
    return `${KEY_PREFIX}${country}`;
  }

  private parse(raw: string): BankCatalogEntry[] | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) {
      return null;
    }
    const entries: BankCatalogEntry[] = [];
    for (const item of parsed) {
      const entry = this.toEntry(item);
      if (entry === null) {
        return null;
      }
      entries.push(entry);
    }

    return entries;
  }

  private toEntry(item: unknown): BankCatalogEntry | null {
    if (typeof item !== 'object' || item === null) {
      return null;
    }
    const bankId: unknown = Reflect.get(item, 'bankId');
    const name: unknown = Reflect.get(item, 'name');
    const countryCode: unknown = Reflect.get(item, 'countryCode');
    const logoUrl: unknown = Reflect.get(item, 'logoUrl');
    if (typeof bankId !== 'string' || typeof name !== 'string') {
      return null;
    }
    if (typeof countryCode !== 'string') {
      return null;
    }
    if (logoUrl !== null && typeof logoUrl !== 'string') {
      return null;
    }

    return { bankId, name, countryCode, logoUrl };
  }
}
