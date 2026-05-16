import { describe, it, expect } from 'vitest';
import type { BankAccountId, IsoDate } from '@power-budget/core';
import { IdempotentIngest } from './idempotent-ingest.js';

const BASE_INPUT = {
  accountId: 'acc-1' as BankAccountId,
  occurredOn: '2024-01-15' as IsoDate,
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
      const other = { ...BASE_INPUT, occurredOn: '2024-02-01' as IsoDate };
      expect(IdempotentIngest.computeHashKey(BASE_INPUT)).not.toBe(
        IdempotentIngest.computeHashKey(other),
      );
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
