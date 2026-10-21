import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../ThemeContext.js';
import { TransactionRow } from '../TransactionRow.js';
import { TransactionMapper } from '../../../infrastructure/api/TransactionMapper.js';
import type { MappingView } from '../../../application/transactions/MappingView.js';

vi.mock('../MoneyView.js', () => ({
  MoneyView: ({ amount }: { amount: { amountMinor: bigint; currency: string } }) => (
    <span>{`${amount.amountMinor} ${amount.currency}`}</span>
  ),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>
  </IntlProvider>
);

function tx(status: 'pending' | 'posted' | 'cancelled' = 'posted') {
  return TransactionMapper.fromListItem({
    id: 'tx-1',
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-1500', currency: 'PLN' },
    description: 'Biedronka',
    merchant: null,
    source: 'bank_sync',
    status,
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
    mapping: null,
    mappingSource: 'none',
    transfer: null,
  });
}

function mapped(by: 'manual' | 'rule' | 'ai', planArchived = false): MappingView {
  return {
    kind: 'mapped',
    plannedItemId: 'i',
    categoryName: 'Groceries',
    planName: 'May',
    planArchived,
    by,
  };
}

function renderRow(mapping: MappingView, status: 'pending' | 'posted' | 'cancelled' = 'posted') {
  const onClick = vi.fn();
  const onMap = vi.fn();
  render(
    <TransactionRow transaction={tx(status)} mapping={mapping} onClick={onClick} onMap={onMap} />,
    {
      wrapper,
    },
  );

  return { onClick, onMap };
}

describe('TransactionRow', () => {
  it('names the category a mapped row maps to, with no "Unmapped" chip', () => {
    renderRow(mapped('manual'));

    expect(screen.getByTestId('mapping-target').textContent).toBe('Groceries');
    expect(screen.queryByText('Unmapped')).toBeNull();
    expect(screen.getByRole('button', { name: 'Change' })).toBeDefined();
  });

  it('says "Unmapped" for an unmapped row with no suggestion', () => {
    renderRow({ kind: 'unmapped', suggested: false });

    expect(screen.getByText('Unmapped')).toBeDefined();
    expect(screen.queryByText('Suggested')).toBeNull();
  });

  it('says "Suggested" when the API proposes an item', () => {
    renderRow({ kind: 'unmapped', suggested: true });

    expect(screen.getByText('Suggested')).toBeDefined();
    expect(screen.queryByText('Unmapped')).toBeNull();
    expect(screen.getByRole('button', { name: 'Map' })).toBeDefined();
  });

  it.each([
    ['manual', 'Manual'],
    ['rule', 'Auto · rule'],
    ['ai', 'Auto · AI'],
  ] as const)('shows the provenance chip of a %s mapping', (by, label) => {
    renderRow(mapped(by));

    expect(screen.getByText(label)).toBeDefined();
  });

  it('flags a mapping into an archived plan', () => {
    renderRow(mapped('manual', true));

    expect(screen.getByText('Archived plan')).toBeDefined();
  });

  it('shows transfer and ignored chips and no Map button for them', () => {
    renderRow({ kind: 'transfer' });
    expect(screen.getByText('Transfer')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Map' })).toBeNull();
  });

  it('shows Ignored', () => {
    renderRow({ kind: 'ignored' });

    expect(screen.getByText('Ignored')).toBeDefined();
  });

  it('shows pending and cancelled, but nothing for a booked row', () => {
    renderRow({ kind: 'unmapped', suggested: false }, 'pending');
    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('opens the map modal from the Map button and the detail from the row', () => {
    const { onClick, onMap } = renderRow({ kind: 'unmapped', suggested: false });

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(onMap).toHaveBeenCalledWith('tx-1');
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Biedronka'));
    expect(onClick).toHaveBeenCalledWith('tx-1');
  });
});
