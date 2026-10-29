import { createMock } from '@golevelup/ts-jest';
import type { PlanDto, PlanDashboardResponseDto } from '@power-budget/shared-app/contract';
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import type { TransactionListItemDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { plansApi } from '../../../../infrastructure/index.js';
import { transactionsGateway } from '../transactions/transactionsGateway.js';
import { TransactionListScreen } from '../TransactionListScreen.js';
import { renderTx } from '../transactions/__tests__/txTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../transactions/transactionsGateway.js', () => {
  const { SerialQueue } = jest.requireActual(
    '../../../../infrastructure/transactions/SerialQueue.js',
  );

  return {
    transactionsGateway: { page: jest.fn(), setMapping: jest.fn() },
    writeQueue: new SerialQueue(),
  };
});
jest.mock('../../../../infrastructure/index.js', () => ({
  apiClient: {},
  plansApi: {
    list: jest.fn().mockResolvedValue([]),
    dashboard: jest.fn(),
    listItems: jest.fn().mockResolvedValue([]),
  },
  categoriesApi: { list: jest.fn().mockResolvedValue([]) },
}));

function unsorted(id: string): TransactionListItemDto {
  return {
    ...createMock<TransactionListItemDto>(),
    id,
    status: 'booked',
    occurredOn: '2026-10-27',
    description: `Shop ${id}`,
    merchant: null,
    amount: { amountMinor: '-1000', currency: 'PLN' },
    mapping: null,
    mappingSource: 'none',
    transfer: null,
    suggestedPlannedItemId: null,
  };
}

describe('TransactionListScreen', () => {
  it('opens the To sort tab from Sort all', async () => {
    const navigate = jest.fn();
    const page: TransactionPageDto = {
      items: [unsorted('a'), unsorted('b')],
      nextCursor: null,
      hasMore: false,
    };
    jest.mocked(transactionsGateway.page).mockResolvedValue(page);
    jest.mocked(plansApi.list).mockResolvedValue([
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
        expenseLines: [],
        totalPlannedExpenses: { amountMinor: '100000', currency: 'PLN' },
        totalActualExpenses: { amountMinor: '20000', currency: 'PLN' },
        unplannedExpenses: { amountMinor: '0', currency: 'PLN' },
      }),
    );
    // The screen reads only `navigate` and `addListener` of the react-navigation prop.
    const navigation = { navigate, addListener: jest.fn(() => jest.fn()) };
    await renderTx(
      <TransactionListScreen
        {...createMock<ComponentProps<typeof TransactionListScreen>>({ navigation })}
      />,
    );
    await waitFor(() => expect(screen.getByText('Sort all 2')).toBeOnTheScreen());

    await fireEvent.press(screen.getByText('Sort all 2'));

    expect(navigate).toHaveBeenCalledWith('ToSort');
  });
});
