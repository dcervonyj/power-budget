import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { TransactionListView } from '../TransactionListView.js';
import type { TransactionListViewProps } from '../TransactionListView.js';
import { GROUPS, LIST_PROPS, MONTH_OVER, ZABKA } from '../transactionFixtures.js';
import { renderTx } from './txTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function renderList(overrides: Partial<TransactionListViewProps> = {}) {
  return renderTx(<TransactionListView {...LIST_PROPS} {...overrides} />);
}

describe('TransactionListView', () => {
  it('shows the month line, what waits to sort and the filter counts', async () => {
    await renderList();

    expect(screen.getByText(/1.?842.* left in October/)).toBeTruthy();
    expect(screen.getByText(/233.* waiting to sort/)).toBeTruthy();
    expect(screen.getByText('To sort 2')).toBeTruthy();
    expect(screen.getByText('Transfers 1')).toBeTruthy();
  });

  it('says over when the month is overspent', async () => {
    await renderList({ month: MONTH_OVER });

    expect(screen.getByText(/Over by .*320.* in October/)).toBeTruthy();
  });

  it('leaves the month panel out without a plan', async () => {
    await renderList({ month: undefined, waiting: undefined });

    expect(screen.queryByText(/left in/)).toBeNull();
    expect(screen.getByTestId('tx-list')).toBeTruthy();
  });

  it('groups rows by day', async () => {
    await renderList();

    expect(screen.getAllByTestId('tx-row')).toHaveLength(5);
    expect(screen.getAllByRole('header').length).toBeGreaterThanOrEqual(3);
  });

  it('reports the filter the user picks', async () => {
    const onFilterChange = jest.fn();
    await renderList({ onFilterChange });

    await userEvent.press(screen.getByText('Sorted 2'));

    expect(onFilterChange).toHaveBeenCalledWith('sorted');
  });

  it('confirms, chooses and opens by transaction id', async () => {
    const onConfirm = jest.fn();
    const onChoose = jest.fn();
    const onOpen = jest.fn();
    await renderList({ onConfirm, onChoose, onOpen });

    await userEvent.press(screen.getByLabelText('Confirm the suggested category for Żabka'));
    await userEvent.press(screen.getByLabelText('Choose a category for Orlen'));
    await userEvent.press(screen.getByRole('button', { name: /Lidl/ }));

    expect(onConfirm).toHaveBeenCalledWith('zabka');
    expect(onChoose).toHaveBeenCalledWith('orlen');
    expect(onOpen).toHaveBeenCalledWith('lidl');
  });

  it('offers Undo for an accepted suggestion and reports it', async () => {
    const onUndo = jest.fn();
    await renderList({ appliedIds: new Set([ZABKA.data.id]), onUndo });

    expect(screen.queryByLabelText('Confirm the suggested category for Żabka')).toBeNull();
    await userEvent.press(screen.getByLabelText('Undo the category for Żabka'));

    expect(onUndo).toHaveBeenCalledWith('zabka');
  });

  it('offers no Confirm for a row without a suggestion', async () => {
    await renderList();

    expect(screen.queryByLabelText('Confirm the suggested category for Orlen')).toBeNull();
  });

  it('sorts everything that waits', async () => {
    const onSortAll = jest.fn();
    await renderList({ onSortAll });

    await userEvent.press(screen.getByText('Sort all 2'));

    expect(onSortAll).toHaveBeenCalledTimes(1);
  });

  it('hides Sort all while no sorting flow is connected', async () => {
    await renderList({ onSortAll: undefined });

    expect(screen.queryByText(/Sort all/)).toBeNull();
  });

  it('keeps Load more when the loaded pages hold nothing for the filter', async () => {
    const onLoadMore = jest.fn();
    await renderList({ groups: [], filter: 'transfers', hasMore: true, onLoadMore });

    expect(screen.getByText('Nothing here for this filter')).toBeTruthy();
    await userEvent.press(screen.getByText('Load more'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when a reload failed and the rows may be stale', async () => {
    const onRetry = jest.fn();
    await renderList({ reloadFailed: true, onRetry });

    expect(screen.getByText(/out of date/)).toBeTruthy();
    expect(screen.getAllByTestId('tx-row')).toHaveLength(5);
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says the totals cover the loaded rows while more pages remain', async () => {
    await renderList({ hasMore: true, onLoadMore: jest.fn() });

    expect(
      screen.getByText('Counts and totals cover the transactions loaded so far.'),
    ).toBeTruthy();
  });

  it('does not qualify the totals once everything is loaded', async () => {
    await renderList({ hasMore: false });

    expect(screen.queryByText(/loaded so far/)).toBeNull();
  });

  it('hides Sort all when nothing waits', async () => {
    await renderList({ counts: { ...LIST_PROPS.counts, toSort: 0 } });

    expect(screen.queryByText(/Sort all/)).toBeNull();
  });

  it('notes that transfers are not spending', async () => {
    await renderList();

    expect(screen.getByText('Transfers between your accounts are not spending.')).toBeTruthy();
  });

  it('loads more on demand', async () => {
    const onLoadMore = jest.fn();
    await renderList({ hasMore: true, onLoadMore });

    await userEvent.press(screen.getByText('Load more'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state for a filter with no rows', async () => {
    await renderList({ groups: [], filter: 'transfers' });

    expect(screen.getByText('Nothing here for this filter')).toBeTruthy();
  });

  it('shows an empty state without transactions', async () => {
    await renderList({ groups: [] });

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });

  it('offers a retry on error', async () => {
    const onRetry = jest.fn();
    await renderList({ status: 'error', groups: [], onRetry });

    expect(screen.getByText('Could not load transactions.')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders rows only when ready', async () => {
    await renderList({ status: 'loading', groups: GROUPS });

    expect(screen.queryAllByTestId('tx-row')).toHaveLength(0);
  });
});
