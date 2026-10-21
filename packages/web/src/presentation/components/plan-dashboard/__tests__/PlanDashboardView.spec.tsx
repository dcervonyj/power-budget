import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { PlanDashboardStore } from '../../../../application/dashboard/PlanDashboardStore.js';
import { PlanDashboardView } from '../PlanDashboardView.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import {
  CATEGORIES,
  DASHBOARD,
  EMPTY_PAGE,
  ITEMS,
  PLAN,
  UNPLANNED_LAST_PAGE,
  UNPLANNED_PAGE,
  apiError,
} from '../../../../test/dashboardFixtures.js';

function makeStore(): { store: PlanDashboardStore; dashboard: ReturnType<typeof vi.fn> } {
  const dashboard = vi.fn().mockResolvedValue(DASHBOARD);
  const unplanned = vi
    .fn()
    .mockImplementation((_planId: string, direction: string, cursor: string | null) =>
      Promise.resolve(
        direction === 'income'
          ? EMPTY_PAGE
          : cursor === null
            ? UNPLANNED_PAGE
            : UNPLANNED_LAST_PAGE,
      ),
    );
  const store = new PlanDashboardStore(
    {
      get: vi.fn().mockResolvedValue(PLAN),
      dashboard,
      listItems: vi.fn().mockResolvedValue(ITEMS),
      unplanned,
    },
    { list: vi.fn().mockResolvedValue(CATEGORIES) },
  );

  return { store, dashboard };
}

describe('PlanDashboardView', () => {
  let store: PlanDashboardStore;
  let dashboard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ store, dashboard } = makeStore());
  });

  it('shows freshness, totals in the base currency and the net including unplanned', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'October' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Data as of 21 Oct 2026');
    expect(screen.getByText('Amounts in PLN', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('PLN 10,000.00')).toBeInTheDocument();
    expect(screen.getByText('PLN 4,600.00')).toBeInTheDocument();
    expect(screen.getByText('+PLN 5,274.50')).toBeInTheDocument();
    expect(
      screen.getByText('Includes unplanned: PLN 125.50 spent, PLN 0.00 received'),
    ).toBeInTheDocument();
  });

  it('shows planned vs actual, status and what is left per category, with its items', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} />);

    const groceries = screen.getByRole('article', { name: 'Groceries' });
    expect(within(groceries).getByText('On track')).toBeInTheDocument();
    expect(within(groceries).getByText('PLN 1,400.00 of PLN 1,930.00')).toBeInTheDocument();
    expect(within(groceries).getByText('PLN 530.00 left')).toBeInTheDocument();
    expect(within(groceries).getByText('Weekly shop')).toBeInTheDocument();
    expect(within(groceries).getByText('planned as €100.00', { exact: false })).toBeInTheDocument();
    expect(within(groceries).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '72');

    const rent = screen.getByRole('article', { name: 'Rent' });
    expect(within(rent).getByText('Over budget')).toBeInTheDocument();
    expect(within(rent).getByText('PLN 200.00 over plan')).toBeInTheDocument();
    expect(within(rent).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

    const salary = screen.getByRole('article', { name: 'Salary' });
    expect(within(salary).getByText('Received')).toBeInTheDocument();
    expect(within(salary).getByText('Fully received')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument();
  });

  it('lists own unplanned transactions in their own currency and pages on', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} />);

    expect(
      screen.getByText(
        "Only your own transactions are listed; your partner's count in the totals.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Allegro')).toBeInTheDocument();
    expect(screen.getByText('-PLN 125.50')).toBeInTheDocument();
    expect(screen.getByText('None of your own transactions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(await screen.findByText('Wise card')).toBeInTheDocument();
    expect(screen.getByText('-€12.40')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('explains missing exchange rates and retries', async () => {
    dashboard.mockRejectedValue(apiError(503, 'fx_rate_unavailable'));
    await store.load('plan-1');
    const onRetry = vi.fn();
    renderWithProviders(<PlanDashboardView store={store} onRetry={onRetry} />);

    expect(
      screen.getByText(
        "Exchange rates are not available right now, so the totals cannot be converted into the plan's base currency. Please try again later.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers the editor for a plan without items', async () => {
    dashboard.mockResolvedValue({ ...DASHBOARD, incomeLines: [], expenseLines: [] });
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} />, {
      path: '/dashboard-under-test',
      url: '/dashboard-under-test',
    });

    expect(screen.getByText('This plan has no planned items yet')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Expenses' })).toBeNull();
  });

  it('formats amounts in the user locale', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} />, { locale: 'pl' });

    await waitFor(() => {
      expect(screen.getByText(/^\+5274,50\szł$/)).toBeInTheDocument();
    });
  });
});
