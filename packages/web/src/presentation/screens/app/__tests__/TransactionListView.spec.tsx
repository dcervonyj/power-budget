import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { TransactionMapper } from '../../../../infrastructure/api/TransactionMapper.js';
import { TransactionListView } from '../TransactionListView.js';
import type {
  DayGroup,
  MonthLeft,
} from '../../../../application/transactions/TransactionListQueryView.js';
import type { TransactionFilters } from '../../../components/TransactionFilterBar.js';

const FILTERS: TransactionFilters = {
  q: '',
  status: '',
  booking: '',
  currency: '',
  category: '',
  from: '',
  to: '',
  source: '',
};

function renderView(month: MonthLeft, groups: readonly DayGroup[] = []) {
  const noop = vi.fn();
  render(
    <MemoryRouter>
      <IntlProvider locale="en" messages={{}}>
        <TransactionListView
          month={month}
          filters={FILTERS}
          onFiltersChange={noop}
          categories={[]}
          status="ready"
          onRetry={noop}
          groups={groups}
          suggestionLabelOf={() => undefined}
          selectedIds={new Set()}
          onToggleRow={noop}
          onToggleAll={noop}
          onAdd={noop}
          onRowClick={noop}
          onRowMap={noop}
          onConfirmSuggestion={noop}
        />
      </IntlProvider>
    </MemoryRouter>,
  );
}

function month(leftMinor: bigint): MonthLeft {
  return {
    periodStart: '2026-10-01',
    left: { amountMinor: leftMinor, currency: 'PLN' },
    planned: { amountMinor: 100000n, currency: 'PLN' },
    fraction: leftMinor > 0n ? 0.5 : 0,
  };
}

describe('TransactionListView month line', () => {
  it('says what is left and labels the rod with it', () => {
    renderView(month(50000n));

    expect(screen.getByText(/left in October/)).toBeDefined();
    expect(screen.getByLabelText(/October: .*500/)).toBeDefined();
  });

  it('shows a positive overspend, not a negative left, when the plan is overspent', () => {
    renderView(month(-12000n));

    expect(screen.getByText(/Over by .*120.* in October/)).toBeDefined();
    expect(screen.getByLabelText(/October: over by .*120/)).toBeDefined();
    expect(screen.queryByText(/-/)).toBeNull();
  });
});

describe('TransactionListView row checkbox', () => {
  it('is named from the description, date and amount, not the id', () => {
    const transaction = TransactionMapper.fromListItem({
      id: 'b1f0c2d4-0000-4000-8000-000000000001',
      accountId: 'acc-1',
      externalId: null,
      occurredOn: '2026-10-21',
      amount: { amountMinor: '-1500', currency: 'PLN' },
      description: 'Biedronka',
      merchant: null,
      source: 'bank_sync',
      status: 'booked',
      ignored: false,
      notes: null,
      suggestedPlannedItemId: null,
      createdAt: '2026-10-21T10:00:00.000Z',
      mapping: null,
      mappingSource: 'none',
      transfer: null,
    });
    renderView(month(50000n), [{ day: '2026-10-21', transactions: [transaction] }]);

    const box = screen.getByRole('checkbox', { name: /^Select transaction Biedronka, .*15/ });
    expect(box.getAttribute('aria-label')).not.toContain('b1f0c2d4');
  });
});
