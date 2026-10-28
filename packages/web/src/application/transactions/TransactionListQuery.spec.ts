import { describe, expect, it } from 'vitest';
import { buildQuery, toListQuery, toTransactions } from './TransactionListQuery.js';
import type { TransactionFilters } from '../../presentation/components/TransactionFilterBar.js';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';

const noFilters: TransactionFilters = {
  from: '',
  to: '',
  category: '',
  status: '',
  booking: '',
  currency: '',
  source: '',
  q: '',
};

function dto(
  id: string,
  currency: string,
  source: TransactionListItemDto['source'],
): TransactionListItemDto {
  return {
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-100', currency },
    description: 'x',
    merchant: null,
    source,
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
    mapping: null,
    mappingSource: 'none',
    transfer: null,
  };
}

describe('buildQuery', () => {
  it('sends every filter to GET /transactions', () => {
    const query = buildQuery(
      {
        from: '2026-10-01',
        to: '2026-10-31',
        category: 'cat-1',
        status: 'unmapped',
        booking: 'pending',
        currency: 'PLN',
        source: 'bank_sync',
        q: 'rent',
      },
      'cursor-1',
    );

    expect(query).toBe(
      'from=2026-10-01&to=2026-10-31&q=rent&unmappedOnly=true&status=pending&categoryId=cat-1&currency=PLN&source=bank_sync&limit=50&cursor=cursor-1',
    );
  });

  it('sends the mapped and transfer mapping filters', () => {
    expect(buildQuery({ ...noFilters, status: 'mapped' })).toBe('mapped=true&limit=50');
    expect(buildQuery({ ...noFilters, status: 'transfer' })).toBe('transfer=true&limit=50');
  });

  it('sends manual rows as source=manual', () => {
    expect(buildQuery({ ...noFilters, source: 'manual' })).toBe('source=manual&limit=50');
  });

  it('sends just the page size without filters', () => {
    expect(buildQuery(noFilters)).toBe('limit=50');
  });
});

describe('toListQuery', () => {
  it('builds the typed contract query', () => {
    expect(toListQuery({ ...noFilters, currency: 'EUR', category: 'cat-1' }, 'c')).toEqual({
      categoryId: 'cat-1',
      currency: 'EUR',
      limit: 50,
      cursor: 'c',
    });
  });
});

describe('toTransactions', () => {
  const page = {
    items: [dto('a', 'PLN', 'bank_sync'), dto('b', 'EUR', 'manual')],
    nextCursor: null,
    hasMore: false,
  };

  it('keeps every row the API returned: the API applies every filter', () => {
    expect(toTransactions(page).map((t) => t.id)).toEqual(['a', 'b']);
  });
});
