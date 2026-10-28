import { describe, it, expect } from 'vitest';
import { BankAccountId, IsoDate } from '@power-budget/core';
import { IdempotentIngest } from './idempotent-ingest.js';

const BASE_INPUT = {
  accountId: BankAccountId.of('01900000-998a-733e-8778-f641457f6a29'),
  occurredOn: IsoDate.of('2024-01-15'),
  amountMinor: 5000n,
  currency: 'PLN',
  normalisedDescription: 'Coffee at Starbucks',
};

describe('IdempotentIngest', () => {
  describe('normaliseDescription', () => {
    it('lowercases and trims', () => {
      expect(IdempotentIngest.normaliseDescription('  COFFEE  ')).toBe('coffee');
    });

    it('collapses multiple spaces', () => {
      expect(IdempotentIngest.normaliseDescription('a  b   c')).toBe('a b c');
    });

    it('removes special chars but keeps Cyrillic', () => {
      const result = IdempotentIngest.normaliseDescription('Кофе #123!');
      expect(result).toContain('кофе');
      expect(result).not.toContain('#');
    });
  });

  describe('computeHashKey', () => {
    it('returns a 32-char hex string', () => {
      const key = IdempotentIngest.computeHashKey(BASE_INPUT);
      expect(key).toHaveLength(32);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('is deterministic for same input', () => {
      expect(IdempotentIngest.computeHashKey(BASE_INPUT)).toBe(
        IdempotentIngest.computeHashKey(BASE_INPUT),
      );
    });

    it('produces different keys for different amounts', () => {
      const other = { ...BASE_INPUT, amountMinor: 9999n };
      expect(IdempotentIngest.computeHashKey(BASE_INPUT)).not.toBe(
        IdempotentIngest.computeHashKey(other),
      );
    });

    it('produces different keys for different dates', () => {
      const other = { ...BASE_INPUT, occurredOn: IsoDate.of('2024-02-01') };
      expect(IdempotentIngest.computeHashKey(BASE_INPUT)).not.toBe(
        IdempotentIngest.computeHashKey(other),
      );
    });
  });

  describe('ordinal (CLN-039)', () => {
    it('keeps the existing key for ordinal 0 and none', () => {
      const key = IdempotentIngest.computeHashKey(BASE_INPUT);

      expect(IdempotentIngest.computeHashKey({ ...BASE_INPUT, ordinal: 0 })).toBe(key);
    });

    it('gives each later identical row its own key', () => {
      const keys = [0, 1, 2].map((ordinal) =>
        IdempotentIngest.computeHashKey({ ...BASE_INPUT, ordinal }),
      );

      expect(new Set(keys).size).toBe(3);
    });
  });

  describe('resolveExternalId', () => {
    it('returns externalId when provided', () => {
      expect(IdempotentIngest.resolveExternalId('ext-123', BASE_INPUT)).toBe('ext-123');
    });

    it('computes hash when externalId is null', () => {
      const key = IdempotentIngest.resolveExternalId(null, BASE_INPUT);
      expect(key).toHaveLength(32);
    });
  });
});
