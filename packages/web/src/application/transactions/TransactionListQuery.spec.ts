import { describe, expect, it } from 'vitest';
import { buildQuery, toTransactions } from './TransactionListQuery.js';
import type { TransactionFilters } from '../../presentation/components/TransactionFilterBar.js';
import type { TransactionDto } from '@power-budget/shared-app/contract';

const noFilters: TransactionFilters = {
  from: '',
  to: '',
  category: '',
  status: '',
  currency: '',
  source: '',
  q: '',
};

function dto(id: string, currency: string, source: TransactionDto['source']): TransactionDto {
  return {
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-100', currency },
    description: 'x',
    merchant: null,
    source,
    status: 'posted',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
  };
}

describe('buildQuery', () => {
  it('sends only the parameters GET /transactions accepts', () => {
    const query = buildQuery(
      {
        from: '2026-10-01',
        to: '2026-10-31',
        category: 'cat-1',
        status: 'unmapped',
        currency: 'PLN',
        source: 'wise',
        q: 'rent',
      },
      'cursor-1',
    );

    expect(query).toBe(
      'from=2026-10-01&to=2026-10-31&q=rent&unmappedOnly=true&limit=50&cursor=cursor-1',
    );
  });

  it('sends just the page size without filters', () => {
    expect(buildQuery(noFilters)).toBe('limit=50');
  });
});

describe('toTransactions', () => {
  const page = {
    items: [dto('a', 'PLN', 'bank_sync'), dto('b', 'EUR', 'manual')],
    nextCursor: null,
    hasMore: false,
  };

  it('filters currency and source on the page', () => {
    expect(toTransactions(page, { ...noFilters, currency: 'EUR' }).map((t) => t.id)).toEqual(['b']);
    expect(toTransactions(page, { ...noFilters, source: 'gocardless' }).map((t) => t.id)).toEqual([
      'a',
    ]);
  });

  it('leaves the mapping unknown: the list endpoint does not carry it', () => {
    expect(toTransactions(page, { ...noFilters, status: 'unmapped' })[0]?.mappingStatus).toBe(
      'unknown',
    );
  });
});
