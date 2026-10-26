import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { EmptyState } from '../shared/EmptyState.js';
import { SkeletonList } from '../shared/SkeletonList.js';
import { AmountText } from '../../glass/atoms/AmountText.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { formatAmount, formatIsoDate } from '../../i18n/formatAmount.js';
import { CategoryGroupCard, IncomeGroupCard } from './CategoryGroupCard.js';
import { OverviewHero } from './OverviewHero.js';
import { ToSortCard } from './ToSortCard.js';
import { UnplannedList } from './UnplannedList.js';
import { formatWeekdayDate } from './overviewDates.js';
import {
  DIM_TEXT_STYLE,
  PANEL_HEADER_STYLE,
  PANEL_PADDING,
  PANEL_TITLE_STYLE,
} from './overviewStyles.js';
import type { PlanDashboardSource } from '../../../application/dashboard/PlanDashboardStore.js';
import type { DashboardOverview } from '../../../application/dashboard/dashboardOverview.js';
import type { PlanDashboard } from '../../../domain/dashboard/PlanDashboard.js';

export interface PlanDashboardViewProps {
  readonly store: PlanDashboardSource;
  readonly onRetry: () => void;
  /** Transactions waiting for a category (shell count); null while unknown. */
  readonly toSortCount: number | null;
}

const COLUMN_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

/**
 * The D7 Overview of one plan: safe to spend today in the lens, pace and forecast, planned vs
 * spent per category, income, the caller's own unplanned transactions and the to-sort link.
 * Every amount is in the plan's base currency unless it says "planned as". Coming up and shared
 * costs have no data yet and are not rendered (DSN-101 / DSN-103).
 */
export const PlanDashboardView = observer(function PlanDashboardView({
  store,
  onRetry,
  toSortCount,
}: PlanDashboardViewProps): React.JSX.Element {
  const { dashboard, overview } = store;

  if (dashboard === null || overview === null) {
    return (
      <div style={COLUMN_STYLE}>
        <ErrorState store={store} onRetry={onRetry} />
        {store.loading && <SkeletonList rows={5} rowHeight={64} />}
      </div>
    );
  }

  const isEmpty = dashboard.income.length === 0 && dashboard.expense.length === 0;

  return (
    <div style={COLUMN_STYLE}>
      <ErrorState store={store} onRetry={onRetry} />
      <OverviewHeader dashboard={dashboard} overview={overview} />
      {isEmpty ? <EmptyPlan planId={dashboard.planId} /> : null}
      {isEmpty ? null : <OverviewHero dashboard={dashboard} overview={overview} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {dashboard.expense.length > 0 ? (
          <ExpensePanel dashboard={dashboard} overview={overview} />
        ) : null}
        <div
          style={{
            ...COLUMN_STYLE,
            flex: '1 1 340px',
            minWidth: 0,
          }}
        >
          {dashboard.income.length > 0 ? <IncomePanel dashboard={dashboard} /> : null}
          <UnplannedPanel dashboard={dashboard} store={store} toSortCount={toSortCount} />
        </div>
      </div>
    </div>
  );
});

function OverviewHeader({
  dashboard,
  overview,
}: {
  dashboard: PlanDashboard;
  overview: DashboardOverview;
}): React.JSX.Element {
  const intl = useIntl();
  const { timing } = overview;

  return (
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '8px 24px',
        padding: '4px 6px 0',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ ...DIM_TEXT_STYLE, fontSize: 'var(--pb-glass-type-body-web)' }}>
          {timing.kind === 'current' ? (
            <FormattedMessage
              id="overview.header.today"
              defaultMessage="{date} · day {day} of {total}"
              values={{
                date: formatWeekdayDate(timing.today, intl),
                day: timing.day,
                total: timing.totalDays,
              }}
            />
          ) : (
            <FormattedMessage
              id="overview.header.period"
              defaultMessage="{start} – {end}"
              values={{
                start: formatIsoDate(dashboard.periodStart, intl.locale),
                end: formatIsoDate(dashboard.periodEnd, intl.locale),
              }}
            />
          )}
        </p>
        <h1
          style={{
            margin: '2px 0 0',
            fontSize: 'var(--pb-glass-type-title-web)',
            lineHeight: 1.15,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            overflowWrap: 'anywhere',
          }}
        >
          {dashboard.planName}
        </h1>
      </div>
      <p style={{ ...DIM_TEXT_STYLE, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}>
        <span role="status">
          <FormattedMessage
            id="planDashboard.asOf"
            defaultMessage="Data as of {date}"
            values={{ date: formatIsoDate(dashboard.asOf, intl.locale) }}
          />
        </span>
        <span>
          {dashboard.planType === 'household' ? (
            <FormattedMessage id="planDashboard.type.household" defaultMessage="Household plan" />
          ) : (
            <FormattedMessage id="planDashboard.type.personal" defaultMessage="Personal plan" />
          )}
        </span>
        <span>
          <FormattedMessage
            id="planDashboard.baseCurrency"
            defaultMessage="Amounts in {currency}"
            values={{ currency: dashboard.baseCurrency }}
          />
        </span>
      </p>
    </header>
  );
}

function EmptyPlan({ planId }: { planId: string }): React.JSX.Element {
  const navigate = useNavigate();

  return (
    <EmptyState
      title={
        <FormattedMessage
          id="planDashboard.empty.title"
          defaultMessage="This plan has no planned items yet"
        />
      }
      action={{
        label: <FormattedMessage id="planDashboard.empty.action" defaultMessage="Edit plan" />,
        onPress: () => {
          void navigate(`/plans/${planId}`);
        },
      }}
    />
  );
}

function ExpensePanel({
  dashboard,
  overview,
}: {
  dashboard: PlanDashboard;
  overview: DashboardOverview;
}): React.JSX.Element {
  return (
    <GlassPanel
      material="frosted"
      depth={1}
      decor={{ specular: true, film: true, sweep: 2 }}
      rise={3}
      style={{ flex: '999 1 620px', minWidth: 0 }}
      contentStyle={{ padding: PANEL_PADDING }}
    >
      <section aria-labelledby="overview-categories-title">
        <div style={{ ...PANEL_HEADER_STYLE, paddingBottom: 12 }}>
          <h2 id="overview-categories-title" style={PANEL_TITLE_STYLE}>
            <FormattedMessage id="overview.categories.title" defaultMessage="Planned vs spent" />
          </h2>
          <p style={DIM_TEXT_STYLE}>
            <FormattedMessage id="overview.categories.legend" defaultMessage="Light = money left" />
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
            gap: 12,
          }}
        >
          {dashboard.expense.map((group, index) => (
            <CategoryGroupCard
              key={group.categoryId}
              group={group}
              index={index}
              forecast={overview.categoryForecasts.get(group.categoryId)}
            />
          ))}
        </div>
      </section>
    </GlassPanel>
  );
}

function IncomePanel({ dashboard }: { dashboard: PlanDashboard }): React.JSX.Element {
  const intl = useIntl();

  return (
    <GlassPanel
      material="frosted"
      depth={2}
      decor={{ specular: true, film: true }}
      rise={4}
      contentStyle={{ padding: PANEL_PADDING }}
    >
      <section
        aria-labelledby="overview-income-title"
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={PANEL_HEADER_STYLE}>
          <h2 id="overview-income-title" style={PANEL_TITLE_STYLE}>
            <FormattedMessage id="planDashboard.section.income" defaultMessage="Income" />
          </h2>
          <span style={DIM_TEXT_STYLE}>
            <FormattedMessage
              id="planDashboard.amountOfPlanned"
              defaultMessage="{actual} of {planned}"
              values={{
                actual: formatAmount(dashboard.totals.actualIncome, intl.locale),
                planned: formatAmount(dashboard.totals.plannedIncome, intl.locale),
              }}
            />
          </span>
        </div>
        {dashboard.income.map((group) => (
          <IncomeGroupCard key={group.categoryId} group={group} />
        ))}
      </section>
    </GlassPanel>
  );
}

/** Observer: the unplanned pages load after the dashboard and change on "Show more". */
const UnplannedPanel = observer(function UnplannedPanel({
  dashboard,
  store,
  toSortCount,
}: {
  dashboard: PlanDashboard;
  store: PlanDashboardSource;
  toSortCount: number | null;
}): React.JSX.Element {
  return (
    <GlassPanel
      material="frosted"
      depth={2}
      decor={{ specular: true, film: true }}
      rise={5}
      contentStyle={{ padding: PANEL_PADDING }}
    >
      <section
        aria-labelledby="overview-unplanned-title"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={PANEL_HEADER_STYLE}>
          <h2 id="overview-unplanned-title" style={PANEL_TITLE_STYLE}>
            <FormattedMessage id="planDashboard.section.unplanned" defaultMessage="Unplanned" />
          </h2>
          <span style={{ fontSize: 'var(--pb-glass-type-heading-web)' }}>
            <AmountText amount={dashboard.totals.unplannedExpenses} />
          </span>
        </div>
        <p style={DIM_TEXT_STYLE}>
          {dashboard.planType === 'household' ? (
            <FormattedMessage
              id="planDashboard.unplanned.ownOnlyHousehold"
              defaultMessage="Only your own transactions are listed; your partner's count in the totals."
            />
          ) : (
            <FormattedMessage
              id="planDashboard.unplanned.ownOnly"
              defaultMessage="Transactions with no planned item. Amounts in their own currency."
            />
          )}
        </p>
        <UnplannedList
          direction="expense"
          total={dashboard.totals.unplannedExpenses}
          list={store.unplannedExpenses}
          onLoadMore={() => {
            void store.loadMoreUnplanned('expense');
          }}
        />
        <UnplannedList
          direction="income"
          total={dashboard.totals.unplannedIncome}
          list={store.unplannedIncome}
          onLoadMore={() => {
            void store.loadMoreUnplanned('income');
          }}
        />
        {toSortCount !== null && toSortCount > 0 ? <ToSortCard count={toSortCount} /> : null}
      </section>
    </GlassPanel>
  );
});

function ErrorState({
  store,
  onRetry,
}: {
  store: PlanDashboardSource;
  onRetry: () => void;
}): React.JSX.Element | null {
  switch (store.error) {
    case null:
      return null;
    case 'fx_unavailable':
      return (
        <ErrorBanner
          onRetry={onRetry}
          message={
            <FormattedMessage
              id="planDashboard.error.fxUnavailable"
              defaultMessage="Exchange rates are not available right now, so the totals cannot be converted into the plan's base currency. Please try again later."
            />
          }
        />
      );
    case 'not_found':
      return (
        <ErrorBanner
          message={
            <FormattedMessage
              id="planDashboard.error.notFound"
              defaultMessage="This plan was not found."
            />
          }
        />
      );
    case 'failed':
      return (
        <ErrorBanner
          onRetry={onRetry}
          message={
            <FormattedMessage
              id="screen.dashboard.error"
              defaultMessage="Failed to load dashboard"
            />
          }
        />
      );
  }
}
