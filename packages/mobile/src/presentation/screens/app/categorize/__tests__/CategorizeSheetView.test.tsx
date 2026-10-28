import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { CategorizeSheetView } from '../CategorizeSheetView.js';
import type { CategorizeSheetViewProps } from '../CategorizeSheetView.js';
import { ORLEN, QUEUE, sessionOf } from '../categorizeFixtures.js';
import { renderCategorize } from './categorizeTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

async function view(overrides: Partial<CategorizeSheetViewProps> = {}) {
  const props: CategorizeSheetViewProps = {
    isOpen: true,
    onClose: jest.fn(),
    session: sessionOf(ORLEN),
    choicesStatus: 'ready',
    onRetryChoices: jest.fn(),
    ...overrides,
  };

  await renderCategorize(<CategorizeSheetView {...props} />);

  return { props };
}

describe('CategorizeSheetView', () => {
  it('shows the payment, the suggested category first and no percentage', async () => {
    await view();

    expect(screen.getByTestId('payment-card')).toBeOnTheScreen();
    expect(screen.getByText('To sort · 1 of 3')).toBeOnTheScreen();
    const options = screen.getAllByTestId('category-option');
    expect(options[0]).toBeChecked();
    expect(options[1]).not.toBeChecked();
    expect(screen.getByText('Suggested')).toBeOnTheScreen();
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByLabelText('Category')).toBeOnTheScreen();
  });

  it('lists only categories of the payment direction', async () => {
    await view();

    expect(screen.queryByText('Salary')).toBeNull();
    expect(screen.getAllByTestId('category-option')).toHaveLength(4);
  });

  it('previews what the payment drains and announces it politely', async () => {
    await view();

    const preview = screen.getByTestId('rod-preview');
    expect(preview).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByText(/This drains Transport/)).toBeOnTheScreen();
  });

  it('picks another category on tap', async () => {
    const pick = jest.fn();
    await view({ session: sessionOf(ORLEN, { pick }) });

    await fireEvent.press(screen.getAllByTestId('category-option')[2]!);

    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('confirms with one tap from the footer', async () => {
    const confirm = jest.fn();
    await view({ session: sessionOf(ORLEN, { confirm }) });

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Transport' }));

    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('disables Confirm and marks it busy while saving', async () => {
    const confirm = jest.fn();
    await view({ session: sessionOf(ORLEN, { phase: 'saving', confirm }) });

    const button = screen.getByRole('button', { name: 'Confirm · Transport' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks for a category when none is picked and cannot confirm', async () => {
    const confirm = jest.fn();
    await view({ session: sessionOf(ORLEN, { picked: undefined, impact: undefined, confirm }) });

    const button = screen.getByRole('button', { name: 'Choose a category first' });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('shows the Confirmed card with Next and Undo', async () => {
    const undo = jest.fn();
    const next = jest.fn();
    await view({ session: sessionOf(ORLEN, { phase: 'done', undo, next }) });

    expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen();
    expect(screen.getByText('Sorted into Transport')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: Bolt' }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('offers Finish instead of Next on the last payment', async () => {
    await view({
      session: sessionOf(QUEUE[2]!, { phase: 'done', nextTitle: undefined }),
    });

    expect(screen.getByRole('button', { name: 'Finish' })).toBeOnTheScreen();
  });

  it('disables Undo and marks it busy while the undo is in flight', async () => {
    const undo = jest.fn();
    await view({ session: sessionOf(ORLEN, { phase: 'undoing', undo }) });

    const button = screen.getByRole('button', { name: 'Undo' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(undo).not.toHaveBeenCalled();
  });

  it('shows All sorted with the count and both exits', async () => {
    const onBackToTransactions = jest.fn();
    const { props } = await view({
      onBackToTransactions,
      session: sessionOf(ORLEN, {
        allDone: true,
        sortedCount: 3,
        row: undefined,
        picked: undefined,
      }),
    });

    expect(screen.getByTestId('all-sorted')).toBeOnTheScreen();
    expect(screen.getByText('3 payments sorted.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to transactions' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onBackToTransactions).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('hides Back to transactions when no handler is given', async () => {
    await view({
      session: sessionOf(ORLEN, {
        allDone: true,
        sortedCount: 1,
        row: undefined,
        picked: undefined,
      }),
    });

    expect(screen.queryByRole('button', { name: 'Back to transactions' })).toBeNull();
    expect(screen.getByText('1 payment sorted.')).toBeOnTheScreen();
  });

  it('shows the confirm failure and keeps the choices', async () => {
    await view({ session: sessionOf(ORLEN, { failure: 'confirm' }) });

    expect(screen.getByText('Could not sort the payment. Try again.')).toBeOnTheScreen();
    expect(screen.getAllByTestId('category-option').length).toBeGreaterThan(0);
  });

  it('shows the undo failure on the Confirmed card', async () => {
    await view({ session: sessionOf(ORLEN, { phase: 'done', failure: 'undo' }) });

    expect(screen.getByText('Could not undo. The payment is still sorted.')).toBeOnTheScreen();
    expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen();
  });

  it('shows a loading note and no options while the categories load', async () => {
    await view({
      choicesStatus: 'loading',
      session: sessionOf(ORLEN, { options: [], picked: undefined, impact: undefined }),
    });

    expect(screen.getByText('Loading categories')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('category-option')).toHaveLength(0);
  });

  it('retries the categories after a load error', async () => {
    const onRetryChoices = jest.fn();
    await view({
      choicesStatus: 'error',
      onRetryChoices,
      session: sessionOf(ORLEN, { options: [], picked: undefined, impact: undefined }),
    });

    expect(screen.getByText('Could not load the categories.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryChoices).toHaveBeenCalledTimes(1);
  });

  it('warns that the balances may be old and retries the refresh', async () => {
    const onRetryChoices = jest.fn();
    await view({ choicesStale: true, onRetryChoices });

    expect(
      screen.getByText('Could not refresh the balances. The previews may be out of date.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryChoices).toHaveBeenCalledTimes(1);
  });

  it('names the plan of each category only when several plans are offered', async () => {
    await view();
    expect(screen.queryByText('October')).toBeNull();
  });

  it('names the plan of each category when several plans are offered', async () => {
    const base = sessionOf(ORLEN);
    const options = base.options.map((option, index) =>
      index === 1 ? { ...option, planName: 'November' } : option,
    );
    await view({ session: sessionOf(ORLEN, { options }) });

    expect(screen.getByText('November')).toBeOnTheScreen();
    expect(screen.getAllByText('October').length).toBeGreaterThan(0);
  });

  it('says so when no category fits', async () => {
    await view({
      session: sessionOf(ORLEN, { options: [], picked: undefined, impact: undefined }),
    });

    expect(
      screen.getByText('No category in the current plan fits this payment.'),
    ).toBeOnTheScreen();
  });
});
