import { describe, it, expect } from 'vitest';
import { applyMappingSuggestion } from '../src/logic/apply-mapping-suggestion.js';
import type { Transaction } from '../src/domain/transactions/entities.js';
import type { PriorMapping } from '../src/logic/apply-mapping-suggestion.js';
import type { IsoDate, IsoDateTime } from '../src/domain/shared/ids.js';

const id = <T>(s: string): T => s as unknown as T;

function makeTx(merchant: string | null, desc: string): Transaction {
  return {
    id: id('tx-new'),
    householdId: id('hh-1'),
    accountId: id('acc-1'),
    externalId: null,
    source: 'bank',
    status: 'posted',
    amount: { amountMinor: 5000n, currency: 'PLN' },
    description: desc,
    merchantName: merchant,
    bookedAt: '2024-02-01' as IsoDate,
    createdAt: '2024-02-01T00:00:00Z' as IsoDateTime,
  };
}

function makeMapping(
  merchant: string | null,
  desc: string,
  mappedAt: string,
  plannedItemId: string,
): PriorMapping {
  return {
    transactionId: id('tx-old'),
    plannedItemId: id(plannedItemId),
    merchantName: merchant,
    description: desc,
    mappedAt: mappedAt as IsoDateTime,
  };
}

describe('applyMappingSuggestion', () => {
  it('returns null when no prior mappings', () => {
    const result = applyMappingSuggestion(makeTx('Starbucks', 'Coffee'), []);
    expect(result).toBeNull();
  });

  it('returns null when no match found', () => {
    const result = applyMappingSuggestion(makeTx('Starbucks', 'Coffee'), [
      makeMapping('McDonalds', 'Fast food', '2024-01-01T00:00:00Z', 'item-1'),
    ]);
    expect(result).toBeNull();
  });

  it('matches exact merchant name (case-insensitive)', () => {
    const result = applyMappingSuggestion(makeTx('STARBUCKS', 'Coffee purchase'), [
      makeMapping('Starbucks', 'Coffee', '2024-01-15T00:00:00Z', 'item-groceries'),
    ]);
    expect(result).toBe('item-groceries');
  });

  it('returns most recent when multiple merchant matches', () => {
    const result = applyMappingSuggestion(makeTx('Biedronka', 'Groceries'), [
      makeMapping('Biedronka', 'Groceries', '2024-01-01T00:00:00Z', 'item-old'),
      makeMapping('Biedronka', 'Groceries', '2024-01-20T00:00:00Z', 'item-recent'),
    ]);
    expect(result).toBe('item-recent');
  });

  it('falls back to description substring match when no merchant', () => {
    const result = applyMappingSuggestion(makeTx(null, 'Monthly Netflix subscription'), [
      makeMapping(null, 'Netflix', '2024-01-10T00:00:00Z', 'item-subscriptions'),
    ]);
    expect(result).toBe('item-subscriptions');
  });

  it('merchant match takes priority over description match', () => {
    const result = applyMappingSuggestion(makeTx('Lidl', 'Lidl groceries purchase'), [
      makeMapping(null, 'Lidl', '2024-01-20T00:00:00Z', 'item-by-desc'),
      makeMapping('Lidl', 'Supermarket', '2024-01-01T00:00:00Z', 'item-by-merchant'),
    ]);
    // Merchant match should win regardless of date
    expect(result).toBe('item-by-merchant');
  });

  it('normalises whitespace and special chars before matching', () => {
    const result = applyMappingSuggestion(makeTx('Żabka  #123!', 'Store purchase'), [
      makeMapping('żabka  #123!', 'Store', '2024-01-15T00:00:00Z', 'item-convenience'),
    ]);
    expect(result).toBe('item-convenience');
  });

  it('returns null for very short description to avoid false positives', () => {
    const result = applyMappingSuggestion(
      makeTx(null, 'AB'), // too short (< 3 chars)
      [makeMapping(null, 'AB test transaction', '2024-01-15T00:00:00Z', 'item-1')],
    );
    expect(result).toBeNull();
  });
});
