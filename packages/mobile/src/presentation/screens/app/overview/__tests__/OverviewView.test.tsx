import React from 'react';
import { IntlProvider } from 'react-intl';
import { render, screen, userEvent, within } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/index.js';
import { MESSAGES, plain } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import overviewEn from '../../../../../../assets/locales/en/overview.json';
import overviewPl from '../../../../../../assets/locales/pl/overview.json';
import { d7Model, pln } from '../overviewFixtures.js';
import type { OverviewModel } from '../overviewModel.js';
import { OverviewView, type OverviewViewProps } from '../OverviewView.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const LOCALE_MESSAGES = {
  en: { ...MESSAGES.en, ...overviewEn },
  pl: { ...MESSAGES.pl, ...overviewPl },
} as const;

interface Callbacks {
  readonly onSelectPlan: jest.Mock;
  readonly onRefresh: jest.Mock;
  readonly onRetry: jest.Mock;
  readonly onOpenToSort: jest.Mock;
  readonly onOpenPlans: jest.Mock;
}

function callbacks(): Callbacks {
  return {
    onSelectPlan: jest.fn(),
    onRefresh: jest.fn(),
    onRetry: jest.fn(),
    onOpenToSort: jest.fn(),
    onOpenPlans: jest.fn(),
  };
}

async function renderOverview(
  overrides: Partial<OverviewViewProps> & { readonly model: OverviewModel | null },
  handlers: Callbacks = callbacks(),
  locale: 'en' | 'pl' = 'en',
): Promise<Callbacks> {
  const props: OverviewViewProps = {
    loading: false,
    refreshing: false,
    error: null,
    noActivePlan: false,
    plans: [],
    selectedPlanId: overrides.model === null ? null : overrides.model.planId,
    toSortCount: null,
    sync: null,
    ...handlers,
    ...overrides,
  };
  await render(
    <ThemeProvider>
      <IntlProvider locale={locale} messages={LOCALE_MESSAGES[locale]}>
        <OverviewView {...props} />
      </IntlProvider>
    </ThemeProvider>,
  );

  return handlers;
}

function textOf(testId: string): string {
  return plain(String(screen.getByTestId(testId).props.children));
}

describe('OverviewView with the D7 spec month', () => {
  it('shows the plan, the day of the month and the bank sync chip', async () => {
    await renderOverview({ model: d7Model(), sync: { kind: 'bank-age', ageMinutes: 120 } });

    expect(screen.getByText('October')).toBeTruthy();
    expect(screen.getByText(/day 22 of 31/)).toBeTruthy();
    expect(screen.getByText('Your bank updated 2 hours ago')).toBeTruthy();
  });

  it('shows 477 a day for the 10 days left in the lens, with what is left of the plan', async () => {
    await renderOverview({ model: d7Model() });

    expect(screen.getByText('Safe to spend today')).toBeTruthy();
    expect(screen.getByText('477')).toBeTruthy();
    expect(screen.getByText('10 days left')).toBeTruthy();
    expect(plain(screen.getByTestId('lens-frame').props.accessibilityLabel)).toMatch(
      /477\.00.* a day, 10 days left/,
    );
    expect(textOf('overview-left')).toMatch(/4,770.* left of .*11,800.* planned/);
    expect(screen.getByText('Spent so far')).toBeTruthy();
    expect(screen.getByText('Income')).toBeTruthy();
  });

  it('says under pace in words, with the percentages and the at-this-pace forecast', async () => {
    await renderOverview({ model: d7Model() });

    expect(screen.getByText('Under pace')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('71%')).toBeTruthy();
    expect(screen.getByLabelText(/under pace\.$/)).toBeTruthy();
    expect(screen.getByText(/11 points behind the calendar/)).toBeTruthy();
    expect(textOf('overview-forecast')).toMatch(/At this pace: ≈ .*9,906.* spent by 31 Oct/);
  });

  it('opens To sort from the card with the count', async () => {
    const handlers = await renderOverview({ model: d7Model(), toSortCount: 3 });

    expect(screen.getByText('3 to sort')).toBeTruthy();
    await userEvent.press(
      screen.getByRole('button', {
        name: '3 transactions to sort, not in totals yet. Open To sort.',
      }),
    );

    expect(handlers.onOpenToSort).toHaveBeenCalledTimes(1);
  });

  it('hides the to-sort card when the count is unknown or zero', async () => {
    await renderOverview({ model: d7Model(), toSortCount: 0 });

    expect(screen.queryByTestId('overview-to-sort')).toBeNull();
  });

  it('caps the to-sort title at 99+', async () => {
    await renderOverview({ model: d7Model(), toSortCount: 100 });

    expect(screen.getByText('99+ to sort')).toBeTruthy();
  });

  it('lists four categories, over plan first, and shows all ten on request', async () => {
    await renderOverview({ model: d7Model() });

    expect(screen.getAllByTestId('category-row')).toHaveLength(4);
    expect(screen.getAllByTestId('category-row')[0]?.props.accessibilityLabel).toMatch(
      /^Eating out/,
    );
    expect(screen.getByText(/Over by .*62\.50/)).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();

    const toggle = screen.getByRole('button', { name: 'Show all 10 categories' });
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    await userEvent.press(toggle);

    expect(screen.getAllByTestId('category-row')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Show fewer' }).props.accessibilityState).toEqual({
      expanded: true,
    });
  });

  it('shows the unplanned spending under the categories', async () => {
    await renderOverview({ model: d7Model() });

    expect(screen.getByText('Unplanned')).toBeTruthy();
    expect(within(screen.getByTestId('overview-unplanned')).getByText(/425\.00/)).toBeTruthy();
  });

  it('formats in Polish with the narrow złoty symbol', async () => {
    await renderOverview({ model: d7Model() }, callbacks(), 'pl');

    expect(screen.getByText('Bezpiecznie na dziś')).toBeTruthy();
    expect(screen.getByText('477')).toBeTruthy();
    expect(textOf('overview-left')).toMatch(/Zostało 4 ?770 zł z 11 ?800 zł w planie/);
  });
});

describe('OverviewView edge states', () => {
  it('shows 0 a day with an Over plan tag and over pace once the plan is spent', async () => {
    await renderOverview({
      model: d7Model({ totalActualExpenses: pln(1200000n), unplannedExpenses: pln(0n) }),
    });

    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getAllByText('Over plan').length).toBeGreaterThan(0);
    expect(screen.getByText('Over pace')).toBeTruthy();
    expect(screen.getByText(/Spending is past the plan by .*200\.00/)).toBeTruthy();
  });

  it('has no lens and no pace for a past plan', async () => {
    await renderOverview({ model: d7Model({ asOf: '2026-11-03' }) });

    expect(screen.queryByTestId('lens')).toBeNull();
    expect(screen.queryByText('Pace')).toBeNull();
    expect(screen.getByText('This plan ended on 31 Oct.')).toBeTruthy();
    expect(screen.getByText(/1 Oct – 31 Oct/)).toBeTruthy();
  });

  it('switches plans from the picker', async () => {
    const handlers = await renderOverview({
      model: d7Model(),
      plans: [
        { id: 'plan-d7', name: 'October' },
        { id: 'plan-anna', name: 'Anna · October' },
      ],
    });

    await userEvent.press(screen.getByRole('radio', { name: 'Anna · October' }));

    expect(handlers.onSelectPlan).toHaveBeenCalledWith('plan-anna');
  });

  it('shows the skeleton while loading', async () => {
    await renderOverview({ model: null, loading: true });

    expect(
      screen.getAllByTestId('skeleton', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
  });

  it('shows the error with a retry', async () => {
    const handlers = await renderOverview({ model: null, error: 'fx_unavailable' });

    expect(
      screen.getByText(
        'Exchange rates are not available right now, so the totals cannot be shown.',
      ),
    ).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers the plans when there is no active plan', async () => {
    const handlers = await renderOverview({ model: null, noActivePlan: true });

    expect(screen.getByText('No active budget plan')).toBeTruthy();
    await userEvent.press(screen.getByRole('button', { name: 'Go to plans' }));

    expect(handlers.onOpenPlans).toHaveBeenCalledTimes(1);
  });
});
