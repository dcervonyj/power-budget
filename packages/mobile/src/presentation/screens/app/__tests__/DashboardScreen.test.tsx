import React from 'react';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import type { PlanDashboardResponseDto, PlanDto } from '@power-budget/shared-app/contract';
import { ThemeProvider } from '../../../theme/index.js';
import { DashboardScreen } from '../DashboardScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPlansList = jest.fn();
const mockDashboard = jest.fn();
const mockCategoriesList = jest.fn();
const mockGet = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../../../infrastructure/index.js', () => ({
  plansApi: {
    list: (status: string): Promise<unknown> => mockPlansList(status),
    dashboard: (planId: string): Promise<unknown> => mockDashboard(planId),
    get: (): Promise<unknown> => Promise.reject(new Error('not used')),
  },
  categoriesApi: { list: (): Promise<unknown> => mockCategoriesList() },
  apiClient: { get: (url: string): Promise<unknown> => mockGet(url) },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: (): unknown => ({ navigate: mockNavigate }),
}));

const plan = {
  id: 'plan-1',
  name: 'October',
} as PlanDto;

// Shaped exactly like the backend PlanDashboardResponseDto (no `items`, string minor units).
const dashboard: PlanDashboardResponseDto = {
  planId: 'plan-1',
  period: { start: '2026-10-01', end: '2026-10-31' },
  baseCurrency: 'PLN',
  incomeLines: [
    {
      plannedItemId: 'item-salary',
      categoryId: 'cat-salary',
      direction: 'income',
      planned: { amountMinor: '500000', currency: 'PLN' },
      actual: { amountMinor: '500000', currency: 'PLN' },
      remaining: { amountMinor: '0', currency: 'PLN' },
      progressBand: 'ok',
    },
  ],
  expenseLines: [
    {
      plannedItemId: 'item-food',
      categoryId: 'cat-food',
      direction: 'expense',
      planned: { amountMinor: '100000', currency: 'PLN' },
      actual: { amountMinor: '123450', currency: 'PLN' },
      remaining: { amountMinor: '-23450', currency: 'PLN' },
      progressBand: 'over',
    },
  ],
  totalPlannedIncome: { amountMinor: '500000', currency: 'PLN' },
  totalActualIncome: { amountMinor: '500000', currency: 'PLN' },
  totalPlannedExpenses: { amountMinor: '100000', currency: 'PLN' },
  totalActualExpenses: { amountMinor: '123450', currency: 'PLN' },
  unplannedExpenses: { amountMinor: '4200', currency: 'PLN' },
  unplannedIncome: { amountMinor: '0', currency: 'PLN' },
  net: { amountMinor: '372350', currency: 'PLN' },
  asOf: '2026-10-15',
};

function answer(url: string): Promise<unknown> {
  if (url.startsWith('/transactions')) {
    return Promise.resolve({ data: { items: [{}, {}], nextCursor: null, hasMore: false } });
  }

  return Promise.resolve({ data: [] });
}

async function renderScreen(): Promise<void> {
  await render(
    <ThemeProvider>
      <IntlProvider locale="en">
        <DashboardScreen />
      </IntlProvider>
    </ThemeProvider>,
  );
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockPlansList.mockReset().mockResolvedValue([plan]);
    mockDashboard.mockReset().mockResolvedValue(dashboard);
    mockCategoriesList.mockReset().mockResolvedValue([
      { id: 'cat-salary', name: 'Salary' },
      { id: 'cat-food', name: 'Food' },
    ]);
    mockGet.mockReset().mockImplementation(answer);
    mockNavigate.mockReset();
  });

  it('renders a real plan dashboard response for the first active plan', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());
    expect(mockPlansList).toHaveBeenCalledWith('active');
    expect(mockDashboard).toHaveBeenCalledWith('plan-1');
    expect(screen.getByText('October')).toBeTruthy();
    // Over the plan: spent 1 234,50 + 42,00 unplanned against 1 000,00 planned.
    expect(screen.getAllByText(/1,234\.50/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Over by .*234\.50/)).toBeTruthy();
    expect(screen.getAllByText(/42\.00/).length).toBeGreaterThan(0);
    // Income received (was the separate income list with Salary; D7 shows it as a tile).
    expect(screen.getAllByText(/5,000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Over pace')).toBeTruthy();
  });

  it('counts the transactions to sort and opens the To sort tab', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByText('2 to sort')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledWith('/transactions?unmappedOnly=true&limit=100');
    await userEvent.press(screen.getByTestId('overview-to-sort'));

    expect(mockNavigate).toHaveBeenCalledWith('ToSort');
  });

  it('shows the no-plan state and links to the plans', async () => {
    mockPlansList.mockResolvedValue([]);
    await renderScreen();

    await waitFor(() => expect(screen.getByText('No active budget plan')).toBeTruthy());
    expect(mockDashboard).not.toHaveBeenCalled();
    await userEvent.press(screen.getByRole('button', { name: 'Go to plans' }));

    expect(mockNavigate).toHaveBeenCalledWith('Plans');
  });

  it('shows an error with a retry when the plans cannot be read', async () => {
    mockPlansList.mockRejectedValueOnce(new Error('offline'));
    await renderScreen();

    await waitFor(() => expect(screen.getByText('Could not load plans.')).toBeTruthy());
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Food')).toBeTruthy());
  });
});
