import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
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

  it('F1: a mapping failure keeps the saved expense, says it is not categorized and never reposts', async () => {
    mockPatch.mockRejectedValueOnce(new Error('offline'));
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);

    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));

    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    expect(screen.getByText('Saved, but not added to Groceries. Find it in To sort.')).toBeTruthy();
    expect(screen.queryByText('Could not save the expense. Try again.')).toBeNull();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Add PLN 5\.00/ })).toBeNull();
  });

  it('R1-F1: two quick Save presses before a rerender post only one transaction', async () => {
    mockPost.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { id: 'tx-1' } }), 50)),
    );
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    const save = screen.getByRole('button', { name: /^Add PLN 5\.00/ });

    await act(async () => {
      fireEvent.press(save);
      fireEvent.press(save);
    });

    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('F2: Add another reloads the dashboard so the next figures include the saved expense', async () => {
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    expect(mockDashboard).toHaveBeenCalledTimes(1);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Add another' }));

    await waitFor(() => expect(mockDashboard).toHaveBeenCalledTimes(2));
  });

  it('F3: app becoming active after midnight refreshes the date and dashboard', async () => {
    const listeners: Array<(state: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);

      return { remove: jest.fn() };
    });
    jest.useFakeTimers({ now: new Date(2026, 9, 22, 23, 50), advanceTimers: true });
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);

    jest.setSystemTime(new Date(2026, 9, 23, 0, 10));
    await act(async () => {
      listeners.forEach((listener) => {
        listener('active');
      });
    });
    await waitFor(() => expect(mockDashboard).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Oct 23')).toBeTruthy());
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));

    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith(
      '/transactions',
      expect.objectContaining({ occurredOn: '2026-10-23' }),
    );
    jest.useRealTimers();
  });

  it('F5: Add another shows the refresh failure and keeps the saved state instead of editing on stale totals', async () => {
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    mockDashboard.mockRejectedValueOnce(new Error('offline'));

    await userEvent.setup().press(screen.getByRole('button', { name: 'Add another' }));

    await waitFor(() =>
      expect(screen.getByText('Could not refresh your plan. Try again.')).toBeTruthy(),
    );
    expect(screen.queryByRole('radio', { name: 'Groceries' })).toBeNull();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    expect(screen.queryByText('Could not refresh your plan. Try again.')).toBeNull();
  });

  it('F6: date and dashboard refresh at midnight while the screen stays active', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 22, 23, 50), advanceTimers: true });
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByText('Oct 22')).toBeTruthy());
    expect(mockDashboard).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.setSystemTime(new Date(2026, 9, 23, 0, 0, 1));
      jest.advanceTimersByTime(11 * 60 * 1000);
    });

    await waitFor(() => expect(screen.getByText('Oct 23')).toBeTruthy());
    expect(mockDashboard).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('Saved totals: a refresh that lands while Saved does not count the saved expense twice', async () => {
    const listeners: Array<(state: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);

      return { remove: jest.fn() };
    });
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    let landLate: (dashboard: PlanDashboardResponseDto) => void = () => undefined;
    mockDashboard.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landLate = resolve;
        }),
    );
    await act(async () => {
      listeners.forEach((listener) => {
        listener('active');
      });
    });
    await typeAmount(['8', '4']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 84\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    const before = screen.getByText(/Safe to spend today is now/).props.children;

    await act(async () => {
      landLate({
        ...DASHBOARD,
        totalActualExpenses: money('661340'),
        expenseLines: [
          { ...DASHBOARD.expenseLines[0], actual: money('123264'), remaining: money('96736') },
        ],
      });
    });

    expect(screen.getByText(/Safe to spend today is now/).props.children).toEqual(before);
    expect(screen.getByTestId('add-category-line')).toHaveTextContent(/1,051\.36 → PLN 967\.36/);
  });

  it('R2-F2: Undo locks Add another until it completes, then refreshes the totals', async () => {
    let finishUndo: () => void = () => undefined;
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    mockPatch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUndo = () => {
            resolve({ data: {} });
          };
        }),
    );

    await userEvent.setup().press(screen.getByRole('button', { name: 'Undo' }));
    await userEvent.setup().press(screen.getByRole('button', { name: 'Add another' }));

    expect(mockDashboard).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Added')).toBeTruthy();
    await act(async () => {
      finishUndo();
    });
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    expect(mockDashboard).toHaveBeenCalledTimes(2);
  });

  it('R2-F3: a refresh started before Undo cannot overwrite the totals read after it', async () => {
    const listeners: Array<(state: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);

      return { remove: jest.fn() };
    });
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    let landOld: (dashboard: PlanDashboardResponseDto) => void = () => undefined;
    mockDashboard.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landOld = resolve;
        }),
    );
    await act(async () => {
      listeners.forEach((listener) => {
        listener('active');
      });
    });
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    await userEvent.setup().press(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());

    await act(async () => {
      landOld({ ...DASHBOARD, asOf: '2026-10-22', unplannedExpenses: money('99999900') });
    });

    expect(screen.getByTestId('add-safe-after')).toHaveTextContent(/476/);
    expect(screen.queryByText(/999/)).toBeNull();
  });

  it('R2-F4: a failed refresh after Undo shows an error with Retry and keeps editing locked', async () => {
    await renderAdd(<AddExpenseScreen />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    await typeAmount(['5']);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Add PLN 5\.00/ }));
    await waitFor(() => expect(screen.getByText('Added')).toBeTruthy());
    mockDashboard.mockRejectedValueOnce(new Error('offline'));

    await userEvent.setup().press(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() =>
      expect(screen.getByText('Could not refresh your plan. Try again.')).toBeTruthy(),
    );
    expect(screen.queryByRole('radio', { name: 'Groceries' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add another' })).toBeNull();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Groceries' })).toBeTruthy());
    expect(mockDashboard).toHaveBeenCalledTimes(3);
  });
});
