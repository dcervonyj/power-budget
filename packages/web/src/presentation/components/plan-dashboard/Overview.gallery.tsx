import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { PlanDashboardResponseDto } from '@power-budget/shared-app/contract';
import type {
  PlanDashboardError,
  PlanDashboardSource,
  UnplannedList,
} from '../../../application/dashboard/PlanDashboardStore.js';
import { toDashboardOverview } from '../../../application/dashboard/dashboardOverview.js';
import {
  toPlanDashboard,
  toUnplannedTransaction,
} from '../../../infrastructure/api/PlanDashboardMapper.js';
import {
  D7_CATEGORIES,
  D7_DASHBOARD,
  D7_PLAN,
  D7_UNPLANNED_PAGE,
  pln,
} from '../../../test/dashboardFixtures.js';
import type { AccountMenuProps } from '../../shell/AccountMenu.js';
import { AppShellView } from '../../shell/AppShellView.js';
import { PlanDashboardView } from './PlanDashboardView.js';
import { OVERVIEW_CONTAINER_STYLE } from './overviewStyles.js';

/** D7 spec sample month (22 Oct 2026, day 22 of 31); gallery only. */
const ACCOUNT: AccountMenuProps = {
  me: { userId: 'user-anna', name: 'Anna Kowalska' },
  partner: { userId: 'user-marek', name: 'Marek Nowak' },
  themePreference: 'system',
  onThemeChange: noop,
  locale: 'en',
  onLocaleChange: noop,
  onSignOut: noop,
  signingOut: false,
};

/** Cancels the gallery page padding, so the screen fills the viewport as in the app. */
const FULL_BLEED: React.CSSProperties = { margin: 'calc(-1 * var(--pb-glass-space-3xl))' };

const NO_ITEMS: UnplannedList = { items: [], nextCursor: null, loading: false, failed: false };

const D7_UNPLANNED: UnplannedList = {
  items: D7_UNPLANNED_PAGE.items.map(toUnplannedTransaction),
  nextCursor: null,
  loading: false,
  failed: false,
};

function noop(): void {
  // Gallery fixtures do not react to input.
}

function noopLoad(): Promise<void> {
  return Promise.resolve();
}

function loaded(
  overrides: Partial<PlanDashboardResponseDto> = {},
  unplannedExpenses: UnplannedList = D7_UNPLANNED,
): PlanDashboardSource {
  const dashboard = toPlanDashboard(
    { ...D7_DASHBOARD, ...overrides },
    {
      plan: D7_PLAN,
      categoryNames: new Map(D7_CATEGORIES.map((category) => [category.id, category.name])),
      items: [],
    },
  );

  return {
    dashboard,
    overview: toDashboardOverview(dashboard),
    loading: false,
    error: null,
    unplannedExpenses,
    unplannedIncome: NO_ITEMS,
    loadMoreUnplanned: noopLoad,
  };
}

function notLoaded(error: PlanDashboardError | null): PlanDashboardSource {
  return {
    dashboard: null,
    overview: null,
    loading: error === null,
    error,
    unplannedExpenses: NO_ITEMS,
    unplannedIncome: NO_ITEMS,
    loadMoreUnplanned: noopLoad,
  };
}

function OverviewScreen({
  sources,
  toSortCount,
}: {
  sources: readonly PlanDashboardSource[];
  toSortCount: number | null;
}): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={FULL_BLEED}>
        <AppShellView
          active="overview"
          toSortCount={toSortCount}
          syncChips={[{ key: 'own', state: { kind: 'bank-age', ageMinutes: 25 }, viewer: 'owner' }]}
          account={ACCOUNT}
        >
          <div style={OVERVIEW_CONTAINER_STYLE}>
            {sources.map((source, index) => (
              <PlanDashboardView
                key={String(index)}
                store={source}
                onRetry={noop}
                toSortCount={toSortCount}
              />
            ))}
          </div>
        </AppShellView>
      </div>
    </MemoryRouter>
  );
}

/** The D7 Overview: 477 a day for 10 days, under pace, ≈ 9 906 at this pace, 3 to sort. */
export function Current(): React.JSX.Element {
  return <OverviewScreen sources={[loaded()]} toSortCount={3} />;
}

/** The plan is spent: 0 a day with an Over tag, over pace, forecast over plan. */
export function OverPlan(): React.JSX.Element {
  return (
    <OverviewScreen
      sources={[loaded({ totalActualExpenses: pln('1200000'), unplannedExpenses: pln('0') })]}
      toSortCount={null}
    />
  );
}

/** A past plan: no lens, no pace and no forecast, only what was left. */
export function PastPlan(): React.JSX.Element {
  return <OverviewScreen sources={[loaded({ asOf: '2026-11-03' })]} toSortCount={null} />;
}

/** Missing FX rates, a plan that was not found, a plan without items and the loading skeleton. */
export function States(): React.JSX.Element {
  return (
    <OverviewScreen
      sources={[
        notLoaded('fx_unavailable'),
        notLoaded('not_found'),
        loaded(
          {
            incomeLines: [],
            expenseLines: [],
            totalPlannedIncome: pln('0'),
            totalActualIncome: pln('0'),
            totalPlannedExpenses: pln('0'),
            totalActualExpenses: pln('0'),
            unplannedExpenses: pln('0'),
            net: pln('0'),
          },
          NO_ITEMS,
        ),
        notLoaded(null),
      ]}
      toSortCount={null}
    />
  );
}
