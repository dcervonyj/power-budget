import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { TransactionRow } from '../TransactionRow.js';
import { TransactionMapper } from '../../../infrastructure/api/TransactionMapper.js';
import type { MappingView } from '../../../application/transactions/MappingView.js';
import type { TransactionStatus } from '../../../domain/transactions/Transaction.js';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" messages={{}}>
    {children}
  </IntlProvider>
);

function tx(status: TransactionStatus = 'booked') {
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

function renderRow(
  mapping: MappingView,
  status: TransactionStatus = 'booked',
  extra: { suggestionLabel?: string; withConfirm?: boolean } = {},
) {
  const onClick = vi.fn();
  const onMap = vi.fn();
  const onConfirmSuggestion = vi.fn();
  render(
    <TransactionRow
      transaction={tx(status)}
      mapping={mapping}
      onClick={onClick}
      onMap={onMap}
      suggestionLabel={extra.suggestionLabel}
      onConfirmSuggestion={extra.withConfirm === true ? onConfirmSuggestion : undefined}
    />,
    { wrapper },
  );

  return { onClick, onMap, onConfirmSuggestion };
}

describe('TransactionRow', () => {
  it('names the category of a mapped row in its subtitle and offers Change, not To sort', () => {
    renderRow(mapped('manual'));

    expect(screen.getByText(/Groceries/)).toBeDefined();
    expect(screen.queryByText('To sort')).toBeNull();
    expect(screen.getByRole('button', { name: 'Change the category of Biedronka' })).toBeDefined();
  });

  it('tags an unmapped row "To sort" and offers Choose when nothing is suggested', () => {
    renderRow({ kind: 'unmapped', suggested: false });

    expect(screen.getByText('To sort')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose a category for Biedronka' })).toBeDefined();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('offers Choose on an unmapped pending row so it can still be mapped', () => {
    const { onMap } = renderRow({ kind: 'unmapped', suggested: false }, 'pending');

    fireEvent.click(screen.getByRole('button', { name: 'Choose a category for Biedronka' }));
    expect(onMap).toHaveBeenCalledWith('tx-1');
  });

  it('shows the suggestion and Confirm when the API proposes a known item', () => {
    const { onConfirmSuggestion } = renderRow({ kind: 'unmapped', suggested: true }, 'booked', {
      suggestionLabel: 'Groceries',
      withConfirm: true,
    });

    expect(screen.getByText('Suggested: Groceries')).toBeDefined();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm the suggested category for Biedronka' }),
    );
    expect(onConfirmSuggestion).toHaveBeenCalledWith('tx-1');
  });

  it('offers no Confirm for a suggestion whose name is not known', () => {
    renderRow({ kind: 'unmapped', suggested: true }, 'booked', { withConfirm: true });

    expect(screen.queryByText('Confirm')).toBeNull();
    expect(screen.getByText('To sort')).toBeDefined();
  });

  it.each([
    ['manual', 'Added by hand'],
    ['rule', 'By rule'],
    ['ai', 'By rule'],
  ] as const)('shows who sorted a %s mapping: %s', (by, label) => {
    renderRow(mapped(by));

    expect(screen.getByText(label)).toBeDefined();
  });

  it('flags a mapping into an archived plan in the subtitle', () => {
    renderRow(mapped('manual', true));

    expect(screen.getByText(/Archived plan/)).toBeDefined();
  });

  it('tags a transfer and gives it no Change or Choose', () => {
    renderRow({ kind: 'transfer' });

    expect(screen.getByText('Transfer')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Change|Choose/ })).toBeNull();
  });

  it('says Ignored in the subtitle', () => {
    renderRow({ kind: 'ignored' });

    expect(screen.getByText(/Ignored/)).toBeDefined();
  });

  it('tags a pending row Pending', () => {
    renderRow({ kind: 'unmapped', suggested: false }, 'pending');

    expect(screen.getByText('Pending')).toBeDefined();
  });

  it('tags a live row "Just in"', () => {
    renderRow(mapped('rule'), 'live');

    expect(screen.getByText('Just in')).toBeDefined();
  });

  it('says Cancelled for an expired row and does not ask to sort it', () => {
    renderRow({ kind: 'unmapped', suggested: false }, 'expired');

    expect(screen.getByText(/Cancelled/)).toBeDefined();
    expect(screen.queryByText('To sort')).toBeNull();
  });

  it('shows no status tag for a mapped booked row', () => {
    renderRow(mapped('rule'), 'booked');

    expect(screen.queryByText('Pending')).toBeNull();
    expect(screen.queryByText('Just in')).toBeNull();
    expect(screen.queryByText('To sort')).toBeNull();
  });

  it('opens the category chooser from Choose and the detail from the row', () => {
    const { onClick, onMap } = renderRow({ kind: 'unmapped', suggested: false });

    fireEvent.click(screen.getByRole('button', { name: 'Choose a category for Biedronka' }));
    expect(onMap).toHaveBeenCalledWith('tx-1');
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Biedronka'));
    expect(onClick).toHaveBeenCalledWith('tx-1');
  });

  it('opens the chooser from Change on a mapped row', () => {
    const { onMap } = renderRow(mapped('manual'));

    fireEvent.click(screen.getByRole('button', { name: 'Change the category of Biedronka' }));
    expect(onMap).toHaveBeenCalledWith('tx-1');
  });
});
