import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { TransactionDetailView } from '../TransactionDetailView.js';
import type { TransactionDetailViewProps } from '../TransactionDetailView.js';
import { DETAIL, OPTIONS } from '../transactionFixtures.js';
import { renderTx } from './txTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const BASE: TransactionDetailViewProps = {
  status: 'ready',
  transaction: DETAIL,
  options: OPTIONS,
  optionsStatus: 'ready',
  onRetryOptions: jest.fn(),
  pickerOpen: false,
  notes: '',
  saving: false,
  onRetry: jest.fn(),
  onOpenPicker: jest.fn(),
  onClosePicker: jest.fn(),
  onPickItem: jest.fn(),
  onClearMapping: jest.fn(),
  onToggleTransfer: jest.fn(),
  onNotesChange: jest.fn(),
  onSaveNotes: jest.fn(),
};

function renderDetail(overrides: Partial<TransactionDetailViewProps> = {}) {
  return renderTx(<TransactionDetailView {...BASE} {...overrides} />);
}

describe('TransactionDetailView', () => {
  it('shows an unsorted transaction with a Choose action', async () => {
    const onOpenPicker = jest.fn();
    await renderDetail({ onOpenPicker });

    expect(screen.getByText('Orlen')).toBeTruthy();
    expect(screen.getByText('Not sorted yet')).toBeTruthy();
    await userEvent.press(screen.getByText('Choose a category'));

    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('shows the category of a sorted transaction and clears it', async () => {
    const onClearMapping = jest.fn();
    await renderDetail({
      transaction: { ...DETAIL, mapping: { plannedItemId: 'item-fuel' } },
      categoryName: 'Fuel',
      onClearMapping,
    });

    expect(screen.getAllByText('Fuel').length).toBeGreaterThan(0);
    expect(screen.getByText('Change')).toBeTruthy();
    await userEvent.press(screen.getByText('Clear'));

    expect(onClearMapping).toHaveBeenCalledTimes(1);
  });

  it('picks a planned item from the sheet', async () => {
    const onPickItem = jest.fn();
    await renderDetail({ pickerOpen: true, onPickItem });

    await userEvent.press(screen.getByRole('button', { name: /Fuel/ }));

    expect(onPickItem).toHaveBeenCalledWith('item-fuel');
  });

  it('shows an error with a retry when the categories failed to load', async () => {
    const onRetryOptions = jest.fn();
    await renderDetail({ pickerOpen: true, options: [], optionsStatus: 'error', onRetryOptions });

    expect(screen.getByText('Could not load the categories.')).toBeTruthy();
    expect(screen.queryByText('No expense categories in an active plan yet.')).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetryOptions).toHaveBeenCalledTimes(1);
  });

  it('shows an error with a retry when the category of the mapping could not be loaded', async () => {
    const onRetryCategory = jest.fn();
    await renderDetail({ categoryFailed: true, onRetryCategory });

    expect(screen.getByText('Could not load the category of this transaction.')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetryCategory).toHaveBeenCalledTimes(1);
  });

  it('does not claim there are no categories while they load', async () => {
    await renderDetail({ pickerOpen: true, options: [], optionsStatus: 'loading' });

    expect(screen.queryByText('No expense categories in an active plan yet.')).toBeNull();
  });

  it('says so when no category can be picked', async () => {
    await renderDetail({ pickerOpen: true, options: [], optionsStatus: 'ready' });

    expect(screen.getByText('No expense categories in an active plan yet.')).toBeTruthy();
  });

  it('toggles the transfer flag', async () => {
    const onToggleTransfer = jest.fn();
    await renderDetail({ onToggleTransfer });

    await userEvent.press(screen.getByRole('switch'));

    expect(onToggleTransfer).toHaveBeenCalledWith(true);
  });

  it('tags a transfer', async () => {
    await renderDetail({ transaction: { ...DETAIL, isTransfer: true } });

    expect(screen.getByText('Transfer')).toBeTruthy();
    expect(screen.queryByText('To sort')).toBeNull();
  });

  it('edits and saves the notes', async () => {
    const onNotesChange = jest.fn();
    const onSaveNotes = jest.fn();
    await renderDetail({ onNotesChange, onSaveNotes });

    await userEvent.type(screen.getByLabelText('Notes'), 'B');
    await userEvent.press(screen.getByText('Save'));

    expect(onNotesChange).toHaveBeenCalledWith('B');
    expect(onSaveNotes).toHaveBeenCalledTimes(1);
  });

  it('does not save twice while saving', async () => {
    const onSaveNotes = jest.fn();
    await renderDetail({ saving: true, onSaveNotes });

    await userEvent.press(screen.getByText('Save'));

    expect(onSaveNotes).not.toHaveBeenCalled();
  });

  it('offers a retry on error', async () => {
    const onRetry = jest.fn();
    await renderDetail({ status: 'error', transaction: undefined, onRetry });

    expect(screen.getByText('Could not load the transaction.')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says when the transaction is gone', async () => {
    await renderDetail({ status: 'notFound', transaction: undefined });

    expect(screen.getByText('Transaction not found')).toBeTruthy();
  });
});
