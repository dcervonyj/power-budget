import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../domain/transactions/Transaction.js';
import { mappingViewOf } from './MappingView.js';

const base: Transaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  occurredOn: '2026-10-21',
  amount: { amountMinor: -100n, currency: 'PLN' },
  description: 'x',
  merchant: null,
  source: 'manual',
  status: 'booked',
  suggestedPlannedItemId: null,
  isTransfer: false,
  ignored: false,
  notes: null,
  mapping: null,
};

const mapping = {
  plannedItemId: 'item-1',
  planName: 'October',
  planArchived: false,
  categoryName: 'Groceries',
  by: 'rule' as const,
};

describe('mappingViewOf', () => {
  it('reads a mapped row with its names and provenance', () => {
    expect(mappingViewOf({ ...base, mapping })).toEqual({
      kind: 'mapped',
      plannedItemId: 'item-1',
      categoryName: 'Groceries',
      planName: 'October',
      planArchived: false,
      by: 'rule',
    });
  });

  it('tells a suggested unmapped row from a plain one', () => {
    expect(mappingViewOf(base)).toEqual({ kind: 'unmapped', suggested: false });
    expect(mappingViewOf({ ...base, suggestedPlannedItemId: 'item-2' })).toEqual({
      kind: 'unmapped',
      suggested: true,
    });
  });

  it('puts ignored before transfer before mapping, like the API', () => {
    expect(mappingViewOf({ ...base, mapping, isTransfer: true, ignored: true })).toEqual({
      kind: 'ignored',
    });
    expect(mappingViewOf({ ...base, mapping, isTransfer: true })).toEqual({ kind: 'transfer' });
  });
});
