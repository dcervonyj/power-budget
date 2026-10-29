import { createMock } from '@golevelup/ts-jest';
import type {
  PlanDto,
  CategoryDto,
  PlanDashboardResponseDto,
  PlannedItemActualsDto,
} from '@power-budget/shared-app/contract';
import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import type { TransactionListItemDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../../../../infrastructure/index.js';
import { transactionsGateway } from '../../transactions/transactionsGateway.js';
import { ToSortScreen } from '../../ToSortScreen.js';
import { renderCategorize } from './categorizeTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../transactions/transactionsGateway.js', () => {
  const { SerialQueue } = jest.requireActual(
    '../../../../../infrastructure/transactions/SerialQueue.js',
  );

  return {
    transactionsGateway: { page: jest.fn(), setMapping: jest.fn() },
    writeQueue: new SerialQueue(),
  };
});
jest.mock('../../../../../infrastructure/index.js', () => ({
  apiClient: {},
  plansApi: { list: jest.fn(), dashboard: jest.fn() },
  categoriesApi: { list: jest.fn() },
}));

const page = jest.mocked(transactionsGateway.page);
const setMapping = jest.mocked(transactionsGateway.setMapping);

function item(id: string, merchant: string, mapped: boolean): TransactionListItemDto {
  return {
    id,
    status: 'booked',
    occurredOn: '2026-10-27',
    description: merchant,
    merchant: null,
    amount: { amountMinor: '-1000', currency: 'PLN' },
    mapping: mapped
      ? createMock<NonNullable<TransactionListItemDto['mapping']>>({
          plannedItemId: 'item-food',
          planName: 'October',
          categoryName: 'Food',
        })
      : null,
    mappingSource: 'none',
    transfer: null,
    suggestedPlannedItemId: 'item-food',
  };
}

function onePage(...items: TransactionListItemDto[]): TransactionPageDto {
  return { items, nextCursor: null, hasMore: false };
}

function deferred() {
  const holder: { resolve: () => void } = { resolve: () => undefined };
  const promise = new Promise<void>((resolve) => {
    holder.resolve = resolve;
  });

  return { promise, resolve: holder.resolve };
}

function line(
  plannedItemId: string,
  categoryId: string,
  planned: string,
  actual: string,
): PlannedItemActualsDto {
  return createMock<PlannedItemActualsDto>({
    plannedItemId,
    categoryId,
    direction: 'expense',
    planned: { amountMinor: planned, currency: 'PLN' },
    actual: { amountMinor: actual, currency: 'PLN' },
    remaining: { amountMinor: '0', currency: 'PLN' },
  });
}

const navigate = jest.fn();

function screenProps(): ComponentProps<typeof ToSortScreen> {
  const navigation = {
    navigate,
    addListener: jest.fn(() => jest.fn()),
  };

  // The screen reads only `navigate` and `addListener` of the react-navigation prop.
  return createMock<ComponentProps<typeof ToSortScreen>>({ navigation });
}

async function renderScreen() {
  await renderCategorize(<ToSortScreen {...screenProps()} />);
  await waitFor(() => expect(screen.getByTestId('to-sort-list')).toBeOnTheScreen());
}

beforeEach(() => {
  page.mockReset();
  setMapping.mockReset();
  navigate.mockReset();
  jest
    .mocked(plansApi.list)
    .mockResolvedValue([
      createMock<PlanDto>({
        id: 'now',
        name: 'October',
        period: { start: '2000-01-01', end: '2999-12-31' },
      }),
    ]);
  jest.mocked(plansApi.dashboard).mockResolvedValue(
    createMock<PlanDashboardResponseDto>({
      planId: 'now',
      period: { start: '2000-01-01', end: '2999-12-31' },
      baseCurrency: 'PLN',
      incomeLines: [],
      expenseLines: [
        line('item-food', 'cat-food', '50000', '10000'),
        line('item-fun', 'cat-fun', '20000', '0'),
      ],
    }),
  );
  jest
    .mocked(categoriesApi.list)
    .mockResolvedValue([
      createMock<CategoryDto>({ id: 'cat-food', name: 'Food' }),
      createMock<CategoryDto>({ id: 'cat-fun', name: 'Fun' }),
    ]);
});

describe('ToSortScreen', () => {
  it('goes from the list through pick, confirm and undo to All sorted', async () => {
    page.mockResolvedValue(onePage(item('a', 'Orlen', false)));
    setMapping.mockResolvedValue(undefined);
    await renderScreen();

    await fireEvent.press(screen.getByText('Orlen'));
    await waitFor(() => expect(screen.getAllByTestId('category-option')).toHaveLength(2));
    await fireEvent.press(screen.getAllByTestId('category-option')[1]!);
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Fun' }));
    await waitFor(() => expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen());
    expect(setMapping).toHaveBeenLastCalledWith('a', 'item-fun');

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByTestId('confirmed-card')).toBeNull());
    expect(setMapping).toHaveBeenLastCalledWith('a', null);

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Fun' }));
    await waitFor(() => expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));

    expect(screen.getByTestId('all-sorted')).toBeOnTheScreen();
    expect(screen.getByText('1 payment sorted.')).toBeOnTheScreen();
  });

  it('refreshes the list after the sheet closes, without the sorted payment', async () => {
    page.mockResolvedValueOnce(onePage(item('a', 'Orlen', false), item('b', 'Bolt', false)));
    setMapping.mockResolvedValue(undefined);
    await renderScreen();
    await fireEvent.press(screen.getByText('Orlen'));
    await waitFor(() => expect(screen.getAllByTestId('category-option')).toHaveLength(2));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Food' }));
    await waitFor(() => expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen());

    page.mockResolvedValueOnce(onePage(item('a', 'Orlen', true), item('b', 'Bolt', false)));
    await fireEvent.press(screen.getByRole('button', { name: 'Next: Bolt' }));
    await fireEvent.press(screen.getByLabelText('Close'));

    await waitFor(() => expect(page).toHaveBeenCalledTimes(2));
    const list = within(screen.getByTestId('to-sort-list'));
    await waitFor(() => expect(list.queryByText('Orlen')).toBeNull());
    expect(list.getByText('Bolt')).toBeOnTheScreen();
  });

  it('writes once when Confirm is tapped twice while the write is in flight', async () => {
    page.mockResolvedValue(onePage(item('a', 'Orlen', false)));
    const write = deferred();
    setMapping.mockReturnValueOnce(write.promise);
    await renderScreen();
    await fireEvent.press(screen.getByText('Orlen'));
    await waitFor(() => expect(screen.getAllByTestId('category-option')).toHaveLength(2));

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Food' }));
    expect(screen.queryByTestId('confirmed-card')).toBeNull();
    await act(async () => write.resolve());

    await waitFor(() => expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen());
    expect(setMapping).toHaveBeenCalledTimes(1);
  });

  it('shows the failure when Confirm is rejected and lets the user try again', async () => {
    page.mockResolvedValue(onePage(item('a', 'Orlen', false)));
    setMapping.mockRejectedValueOnce(new Error('offline'));
    setMapping.mockResolvedValueOnce(undefined);
    await renderScreen();
    await fireEvent.press(screen.getByText('Orlen'));
    await waitFor(() => expect(screen.getAllByTestId('category-option')).toHaveLength(2));

    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Food' }));
    await waitFor(() =>
      expect(screen.getByText('Could not sort the payment. Try again.')).toBeOnTheScreen(),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Food' }));

    await waitFor(() => expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen());
    expect(setMapping).toHaveBeenCalledTimes(2);
  });

  it('leaves for the Transactions tab from All sorted', async () => {
    page.mockResolvedValue(onePage(item('a', 'Orlen', false)));
    setMapping.mockResolvedValue(undefined);
    await renderScreen();
    await fireEvent.press(screen.getByText('Orlen'));
    await waitFor(() => expect(screen.getAllByTestId('category-option')).toHaveLength(2));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm · Food' }));
    await waitFor(() => expect(screen.getByTestId('confirmed-card')).toBeOnTheScreen());
    await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Back to transactions' }));

    expect(navigate).toHaveBeenCalledWith('Transactions');
  });

  it('shows the list error and loads on retry', async () => {
    page.mockRejectedValueOnce(new Error('offline'));
    await renderCategorize(<ToSortScreen {...screenProps()} />);
    await waitFor(() =>
      expect(screen.getByText('Could not load the payments to sort.')).toBeOnTheScreen(),
    );

    page.mockResolvedValueOnce(onePage(item('a', 'Orlen', false)));
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Orlen')).toBeOnTheScreen());
  });
});
