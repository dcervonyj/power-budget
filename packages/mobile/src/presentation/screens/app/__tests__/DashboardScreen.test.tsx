import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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

jest.mock('../../../../infrastructure/index.js', () => ({
  plansApi: {
    list: (status: string): Promise<unknown> => mockPlansList(status),
    dashboard: (planId: string): Promise<unknown> => mockDashboard(planId),
  },
  categoriesApi: { list: (): Promise<unknown> => mockCategoriesList() },
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

describe('DashboardScreen', () => {
  beforeEach(() => {
    mockPlansList.mockResolvedValue([plan]);
    mockDashboard.mockResolvedValue(dashboard);
    mockCategoriesList.mockResolvedValue([
      { id: 'cat-salary', name: 'Salary' },
      { id: 'cat-food', name: 'Food' },
    ]);
  });

  it('renders a real plan dashboard response without crashing', async () => {
    await render(
      <ThemeProvider>
        <IntlProvider locale="en">
          <DashboardScreen />
        </IntlProvider>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('Salary')).toBeTruthy());
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('October')).toBeTruthy();
    // MoneyText now shows locale-formatted AmountText parts (was "1234.50 PLN").
    expect(screen.getAllByText(/1,234\.50/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3,723\.50/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/42\.00/).length).toBeGreaterThan(0);
  });
});
