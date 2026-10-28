import React from 'react';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import type {
  AccountDto,
  PlanDashboardResponseDto,
  PlanDto,
} from '@power-budget/shared-app/contract';
import { renderAdd } from './renderAdd.js';
import { AddExpenseScreen } from '../../AddExpenseScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: (): unknown => ({ navigate: mockNavigate }),
}));

const mockPlansList = jest.fn();
const mockDashboard = jest.fn();
const mockCategoriesList = jest.fn();
const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();

jest.mock('../../../../../infrastructure/index.js', () => ({
  plansApi: {
    list: (status: string): Promise<unknown> => mockPlansList(status),
    dashboard: (planId: string): Promise<unknown> => mockDashboard(planId),
  },
  categoriesApi: { list: (): Promise<unknown> => mockCategoriesList() },
  apiClient: {
    get: (url: string): Promise<unknown> => mockGet(url),
    post: (url: string, body: unknown): Promise<unknown> => mockPost(url, body),
    patch: (url: string, body: unknown): Promise<unknown> => mockPatch(url, body),
  },
}));

function money(amountMinor: string): { amountMinor: string; currency: string } {
  return { amountMinor, currency: 'PLN' };
}

const PLAN = { id: 'plan-1', name: 'October' } as PlanDto;
const ACCOUNT = { id: 'acc-1', name: 'PKO BP', currency: 'PLN' } as AccountDto;

// D7 fixture: 11 800 planned, 7 030 spent (6 605 mapped + 425 unplanned), 10 days left on 22 Oct.
const DASHBOARD: PlanDashboardResponseDto = {
  planId: 'plan-1',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [],
  expenseLines: [
    {
      plannedItemId: 'item-groceries',
      categoryId: 'cat-groceries',
      direction: 'expense',
      planned: money('220000'),
      actual: money('114864'),
      remaining: money('105136'),
      progressBand: 'ok',
    },
  ],
  totalPlannedIncome: money('0'),
  totalActualIncome: money('0'),
  totalPlannedExpenses: money('1180000'),
  totalActualExpenses: money('660500'),
  unplannedExpenses: money('42500'),
  unplannedIncome: money('0'),
  net: money('0'),
  asOf: '2026-10-22',
};

describe('AddExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlansList.mockResolvedValue([PLAN]);
    mockDashboard.mockResolvedValue(DASHBOARD);
    mockCategoriesList.mockResolvedValue([{ id: 'cat-groceries', name: 'Groceries' }]);
    mockGet.mockResolvedValue({ data: [ACCOUNT] });
    mockPost.mockResolvedValue({ data: { id: 'tx-1' } });
    mockPatch.mockResolvedValue({ data: {} });
  });

  async function typeAmount(keys: readonly string[]): Promise<void> {
    const user = userEvent.setup();
    for (const key of keys) {
      await user.press(screen.getByRole('button', { name: key }));
    }
  }

  it('types 84, shows 468,60 a day and posts the expense mapped to the category', async () => {
    await renderAdd(<AddExpenseScreen />, 'pl');
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());

    await typeAmount(['8', '4']);
    expect(screen.getByTestId('add-safe-after')).toHaveTextContent(/468,60/);

    await userEvent.setup().press(screen.getByRole('button', { name: /^Dodaj 84,00/ }));

    await waitFor(() => expect(screen.getByText('Dodano')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledWith('/accounts');
    expect(mockPost).toHaveBeenCalledWith('/transactions', {
      accountId: 'acc-1',
      occurredOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      amountMinor: '-8400',
      currency: 'PLN',
      description: 'Groceries',
    });
    expect(mockPatch).toHaveBeenCalledWith('/transactions/tx-1/mapping', {
      plannedItemId: 'item-groceries',
    });
  });

  it('undoes a saved expense and goes back to editing with the amount kept', async () => {
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());

    await userEvent.setup().press(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    expect(mockPatch).toHaveBeenLastCalledWith('/transactions/tx-1', { ignored: true });
  });

  it('shows the error and stays editable when the save fails', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);

    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));

    await waitFor(() =>
      expect(screen.getByText('Could not save the expense. Try again.')).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /^Add PLN 5\.00/ })).toBeTruthy();
  });

  it('shows an empty state when there is no active plan', async () => {
    mockPlansList.mockResolvedValue([]);

    await renderAdd(<AddExpenseScreen />);

    await waitFor(() => expect(screen.getByText('No active plan')).toBeTruthy());
  });

  it('goes back to Today from the saved state', async () => {
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());

    await userEvent.setup().press(screen.getByRole('button', { name: 'Back to Today' }));

    expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'Dashboard' });
  });
});
