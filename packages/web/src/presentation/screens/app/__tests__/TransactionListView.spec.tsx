import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { TransactionListView } from '../TransactionListView.js';
import type { MonthLeft } from '../../../../application/transactions/TransactionListQueryView.js';
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

function renderView(month: MonthLeft) {
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
          groups={[]}
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
