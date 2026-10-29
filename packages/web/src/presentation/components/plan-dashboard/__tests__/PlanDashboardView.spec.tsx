import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { PlanDashboardResponseDto } from '@power-budget/shared-app/contract';
import { PlanDashboardStore } from '../../../../application/dashboard/PlanDashboardStore.js';
import { catalogueFor } from '../../../../test/referenceCatalogue.js';
import { PlanDashboardView } from '../PlanDashboardView.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';
import {
  CATEGORIES,
  D7_CATEGORIES,
  D7_DASHBOARD,
  D7_PLAN,
  D7_UNPLANNED_PAGE,
  DASHBOARD,
  EMPTY_PAGE,
  ITEMS,
  PLAN,
  UNPLANNED_LAST_PAGE,
  UNPLANNED_PAGE,
  apiError,
  pln,
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
  const api = {
    get: vi.fn().mockResolvedValue(PLAN),
    dashboard,
    listItems: vi.fn().mockResolvedValue(ITEMS),
    unplanned,
  };
  const store = new PlanDashboardStore(
    api,
    catalogueFor(api, { list: vi.fn().mockResolvedValue(CATEGORIES) }),
  );

  return { store, dashboard };
}

/** The D7 spec month: 22 Oct 2026, planned 11 800, spent 7 030, left 4 770, 10 days left. */
async function loadD7(
  overrides: Partial<PlanDashboardResponseDto> = {},
): Promise<PlanDashboardStore> {
  const api = {
    get: vi.fn().mockResolvedValue(D7_PLAN),
    dashboard: vi.fn().mockResolvedValue({ ...D7_DASHBOARD, ...overrides }),
    listItems: vi.fn().mockResolvedValue([]),
    unplanned: vi
      .fn()
      .mockImplementation((_planId: string, direction: string) =>
        Promise.resolve(direction === 'expense' ? D7_UNPLANNED_PAGE : EMPTY_PAGE),
      ),
  };
  const store = new PlanDashboardStore(
    api,
    catalogueFor(api, { list: vi.fn().mockResolvedValue(D7_CATEGORIES) }),
  );
  await store.load('plan-d7');

  return store;
}

/** Accessible names keep Intl's no-break spaces ("zł 477.00"); compare them as plain spaces. */
function named(expected: string): (name: string) => boolean {
  return (name) => name.replace(/\s/g, ' ') === expected;
}

function tile(label: string): HTMLElement {
  const item = screen.getByText(label).closest('li');
  if (item === null) {
    throw new Error(`No stat tile "${label}"`);
  }

  return item;
}

describe('PlanDashboardView', () => {
  let store: PlanDashboardStore;
  let dashboard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ({ store, dashboard } = makeStore());
  });

  it('shows freshness, totals in the base currency and the net including unplanned', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    expect(screen.getByRole('heading', { name: 'October' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Data as of 21 Oct 2026');
    expect(screen.getByText('Amounts in PLN', { exact: false })).toBeInTheDocument();
    expect(tile('Income received')).toHaveTextContent('zł 10,000.00');
    expect(tile('Income received')).toHaveTextContent('of zł 10,000.00 planned');
    expect(tile('Spent so far')).toHaveTextContent('zł 4,725.50');
    expect(tile('Spent so far')).toHaveTextContent('of zł 4,930.00 planned');
    expect(screen.getByText('+zł 5,274.50')).toBeInTheDocument();
    expect(
      screen.getByText('Includes unplanned: zł 125.50 spent, zł 0.00 received'),
    ).toBeInTheDocument();
  });

  it('shows planned vs actual, status and what is left per category, with its items', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    // Style update (DSN-020): the band words became the D7 CategoryRow tags and the bar a rod.
    const groceries = screen.getByRole('article', { name: 'Groceries' });
    expect(within(groceries).getByText('Under plan')).toBeInTheDocument();
    expect(within(groceries).getByText('zł 1,400.00 of zł 1,930.00')).toBeInTheDocument();
    expect(within(groceries).getByText('zł 530.00 left')).toBeInTheDocument();
    expect(within(groceries).getByText('Weekly shop')).toBeInTheDocument();
    expect(within(groceries).getByText('planned as €100.00', { exact: false })).toBeInTheDocument();
    expect(
      within(groceries).getByRole('img', {
        name: named('Groceries: zł 530.00 left of zł 1,930.00'),
      }),
    ).toBeInTheDocument();
    expect(within(groceries).getByText('· 73% spent')).toBeInTheDocument();

    const rent = screen.getByRole('article', { name: 'Rent' });
    expect(within(rent).getByText('Over by zł 200.00')).toBeInTheDocument();
    expect(
      within(rent).getByRole('img', { name: named('Rent: over by zł 200.00') }),
    ).toBeInTheDocument();

    const salary = screen.getByRole('article', { name: 'Salary' });
    expect(within(salary).getByText('Received')).toBeInTheDocument();
    expect(within(salary).getByText('Fully received')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Planned vs spent' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Income' })).toBeInTheDocument();
  });

  it('lists own unplanned transactions in their own currency and pages on', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    expect(
      screen.getByText(
        "Only your own transactions are listed; your partner's count in the totals.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Allegro')).toBeInTheDocument();
    expect(screen.getByText('Allegro').closest('li')).toHaveTextContent('−zł 125.50');
    expect(screen.getByText('None of your own transactions')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(await screen.findByText('Wise card')).toBeInTheDocument();
    expect(screen.getByText('Wise card').closest('li')).toHaveTextContent('−€12.40');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('explains missing exchange rates and retries', async () => {
    dashboard.mockRejectedValue(apiError(503, 'fx_rate_unavailable'));
    await store.load('plan-1');
    const onRetry = vi.fn();
    renderWithProviders(<PlanDashboardView store={store} onRetry={onRetry} toSortCount={null} />);

    expect(
      screen.getByText(
        "Exchange rates are not available right now, so the totals cannot be converted into the plan's base currency. Please try again later.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('says a missing plan was not found, without a retry', async () => {
    dashboard.mockRejectedValue(apiError(404, 'not_found'));
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    expect(screen.getByText('This plan was not found.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Safe to spend today' })).toBeNull();
  });

  it('offers the editor for a plan without items', async () => {
    dashboard.mockResolvedValue({ ...DASHBOARD, incomeLines: [], expenseLines: [] });
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />, {
      path: '/dashboard-under-test',
      url: '/dashboard-under-test',
    });

    expect(screen.getByText('This plan has no planned items yet')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Planned vs spent' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Safe to spend today' })).toBeNull();
  });

  it('formats amounts in the user locale', async () => {
    await store.load('plan-1');
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />, {
      locale: 'pl',
    });

    await waitFor(() => {
      expect(screen.getByText(/^\+5\s274,50\szł$/)).toBeInTheDocument();
    });
  });
});

describe('PlanDashboardView with the D7 sample month', () => {
  it('shows safe to spend today in the lens with the days left outside it', async () => {
    const store = await loadD7();
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    expect(screen.getByRole('heading', { name: 'Safe to spend today' })).toBeInTheDocument();
    const lens = screen.getByRole('img', { name: named('zł 477.00 a day, 10 days left') });
    expect(within(lens).getByText('477')).toBeInTheDocument();
    expect(within(lens).getByText('zł a day')).toBeInTheDocument();
    expect(lens).not.toContainElement(screen.getByText('10 days left'));
    expect(screen.getByText(/day 22 of 31/)).toHaveTextContent('Thursday, October 22');
    expect(screen.getByTestId('overview-left')).toHaveTextContent('zł 4,770.00');
    expect(
      screen.getByText(/^Spread over the 10 days to October 31, that is zł 477\.00 a day\./),
    ).toBeInTheDocument();
    expect(tile('Spent so far')).toHaveTextContent('zł 7,030.00');
    expect(tile('Spent so far')).toHaveTextContent('of zł 11,800.00 planned');
  });

  it('shows the pace: plan left against month left, under pace in words', async () => {
    const store = await loadD7();
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    const pace = screen.getByRole('region', { name: 'Pace' });
    expect(within(pace).getByText('Under pace')).toBeInTheDocument();
    expect(within(pace).getByText('40%')).toBeInTheDocument();
    expect(within(pace).getByText('29%')).toBeInTheDocument();
    expect(
      within(pace).getByRole('img', {
        name: named(
          'Pace: 40% of the plan is still left as light, 29% of the month is still to come. The light reaches past the mark, so spending is under pace.',
        ),
      }),
    ).toBeInTheDocument();
    expect(within(pace).getByText('Light = money left, zł 4,770.00')).toBeInTheDocument();
    expect(within(pace).getByText('Empty glass = spent, zł 7,030.00')).toBeInTheDocument();
    expect(within(pace).getByText('Mark = month left (29%)')).toBeInTheDocument();
    expect(
      within(pace).getByText(
        'Spending is 11 points behind the calendar. Keep it near zł 477.00 a day and October closes about zł 1,894 under plan.',
      ),
    ).toBeInTheDocument();
  });

  it('forecasts the month end and an over-plan category at this pace', async () => {
    const store = await loadD7();
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    const forecast = tile('Month-end forecast');
    expect(forecast).toHaveTextContent('≈ zł 9,906');
    expect(forecast).toHaveTextContent('≈ zł 1,894 under plan, at this pace');
    const eatingOut = screen.getByRole('article', { name: 'Eating out' });
    expect(within(eatingOut).getByText('≈ zł 793.00 at this pace')).toBeInTheDocument();
    expect(within(eatingOut).getByText('Over by zł 62.50')).toBeInTheDocument();
    const groceries = screen.getByRole('article', { name: 'Groceries' });
    expect(within(groceries).queryByText(/at this pace/)).toBeNull();
    const rent = screen.getByRole('article', { name: 'Rent' });
    expect(within(rent).getByText('Paid')).toBeInTheDocument();
    expect(within(rent).queryByText(/at this pace/)).toBeNull();
  });

  it('says over pace and over plan when the plan is spent', async () => {
    const store = await loadD7({
      totalActualExpenses: pln('1200000'),
      unplannedExpenses: pln('0'),
    });
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    const lens = screen.getByRole('img', { name: named('zł 0.00 a day, 10 days left') });
    expect(within(lens).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Over plan')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Spending is past the plan by zł 200.00, so nothing is left to spend a day until October 31.',
      ),
    ).toBeInTheDocument();
    const pace = screen.getByRole('region', { name: 'Pace' });
    expect(within(pace).getByText('Over pace')).toBeInTheDocument();
    expect(
      within(pace).getByText(
        'Spending is 29 points ahead of the calendar. At this pace October closes about zł 5,109 over plan.',
      ),
    ).toBeInTheDocument();
    expect(tile('Month-end forecast')).toHaveTextContent('≈ zł 5,109 over plan, at this pace');
  });

  it('hides the lens, pace and forecast for a past plan', async () => {
    const store = await loadD7({ asOf: '2026-11-03' });
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    expect(screen.getByRole('heading', { name: 'Left in the plan' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Safe to spend today' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Pace' })).toBeNull();
    expect(screen.queryByText('Month-end forecast')).toBeNull();
    expect(screen.getByText('This plan ended on October 31.')).toBeInTheDocument();
    expect(screen.getByTestId('overview-left')).toHaveTextContent('zł 4,770.00');
  });

  it('hides the lens and pace for a plan that has not started', async () => {
    const store = await loadD7({ asOf: '2026-09-28' });
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);

    expect(screen.queryByRole('region', { name: 'Pace' })).toBeNull();
    expect(
      screen.getByText(
        'This plan starts on October 1. Safe to spend and pace appear once it runs.',
      ),
    ).toBeInTheDocument();
  });

  it('lists unplanned spending and links to the transactions to sort', async () => {
    const store = await loadD7();
    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={3} />);

    const unplanned = screen.getByRole('region', { name: 'Unplanned' });
    expect(within(unplanned).getByText('Decathlon').closest('li')).toHaveTextContent('−zł 220.00');
    expect(within(unplanned).getByText('Empik')).toBeInTheDocument();
    const toSort = within(unplanned).getByRole('link', {
      name: '3 to sort · waiting for a category',
    });
    expect(toSort).toHaveAttribute('href', '/transactions?status=unmapped');
    expect(within(toSort).getByText('3')).toBeInTheDocument();
  });

  it('shows no to-sort link when nothing waits or the count is unknown', async () => {
    const store = await loadD7();
    const first = renderWithProviders(
      <PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={0} />,
    );
    expect(screen.queryByRole('link', { name: /to sort/ })).toBeNull();
    first.unmount();

    renderWithProviders(<PlanDashboardView store={store} onRetry={vi.fn()} toSortCount={null} />);
    expect(screen.queryByRole('link', { name: /to sort/ })).toBeNull();
  });
});
