import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { EmptyState } from '../shared/EmptyState.js';
import { SkeletonList } from '../shared/SkeletonList.js';
import { formatAmount, formatIsoDate, formatSignedAmount } from '../../i18n/formatAmount.js';
import { CategoryGroupCard } from './CategoryGroupCard.js';
import { UnplannedList } from './UnplannedList.js';
import type { PlanDashboardStore } from '../../../application/dashboard/PlanDashboardStore.js';
import type {
  DashboardCategoryGroup,
  MoneyAmount,
  PlanDashboard,
} from '../../../domain/dashboard/PlanDashboard.js';

export interface PlanDashboardViewProps {
  readonly store: PlanDashboardStore;
  readonly onRetry: () => void;
}

const LABEL_STYLE_KEYS = { textTransform: 'uppercase', letterSpacing: '0.04em' } as const;

function StatCard({
  label,
  value,
  sub,
  accent,
  hero = false,
}: {
  label: React.ReactNode;
  value: string;
  sub: React.ReactNode;
  accent: string;
  hero?: boolean;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <section
      style={{
        flex: hero ? '1.4 1 240px' : '1 1 180px',
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.xs,
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        background: hero
          ? `linear-gradient(160deg, ${theme.color.hero.bgStart}, ${theme.color.hero.bgEnd})`
          : theme.color.surface.raised,
        border: `1px solid ${theme.color.border.subtle}`,
        borderTop: `2px solid ${hero ? theme.color.hero.topAccent : theme.color.border.subtle}`,
      }}
    >
      <span
        style={{
          ...LABEL_STYLE_KEYS,
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.secondary,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: hero ? theme.fontSize['3xl'] : theme.fontSize['2xl'],
          fontWeight: theme.fontWeight.bold,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: theme.lineHeight.tight,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>{sub}</span>
    </section>
  );
}

function Summary({ dashboard }: { dashboard: PlanDashboard }): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const { totals } = dashboard;
  const netColor =
    totals.net.amountMinor >= 0n ? theme.color.status.success : theme.color.status.danger;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space.md }}>
      <StatCard
        label={
          <FormattedMessage id="planDashboard.summary.income" defaultMessage="Income received" />
        }
        value={formatAmount(totals.actualIncome, intl.locale)}
        accent={theme.color.income.default}
        sub={
          <FormattedMessage
            id="planDashboard.summary.ofPlanned"
            defaultMessage="of {amount} planned"
            values={{ amount: formatAmount(totals.plannedIncome, intl.locale) }}
          />
        }
      />
      <StatCard
        label={<FormattedMessage id="planDashboard.summary.spent" defaultMessage="Spent" />}
        value={formatAmount(totals.actualExpenses, intl.locale)}
        accent={theme.color.status.warning}
        sub={
          <FormattedMessage
            id="planDashboard.summary.ofPlanned"
            defaultMessage="of {amount} planned"
            values={{ amount: formatAmount(totals.plannedExpenses, intl.locale) }}
          />
        }
      />
      <StatCard
        hero
        label={<FormattedMessage id="planDashboard.summary.net" defaultMessage="Net result" />}
        value={formatSignedAmount(totals.net, intl.locale)}
        accent={netColor}
        sub={
          <FormattedMessage
            id="planDashboard.summary.netIncludesUnplanned"
            defaultMessage="Includes unplanned: {spent} spent, {received} received"
            values={{
              spent: formatAmount(totals.unplannedExpenses, intl.locale),
              received: formatAmount(totals.unplannedIncome, intl.locale),
            }}
          />
        }
      />
    </div>
  );
}

function Section({
  title,
  total,
  groups,
}: {
  title: React.ReactNode;
  total: React.ReactNode;
  groups: readonly DashboardCategoryGroup[];
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.sm,
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.color.surface.raised,
        border: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: theme.space.md }}>
        <h2
          style={{
            flex: 1,
            margin: 0,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.color.text.secondary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {total}
        </span>
      </header>
      {groups.map((group) => (
        <CategoryGroupCard key={group.categoryId} group={group} />
      ))}
    </section>
  );
}

function amountOfPlanned(
  actual: MoneyAmount,
  planned: MoneyAmount,
  locale: string,
): React.ReactNode {
  return (
    <FormattedMessage
      id="planDashboard.amountOfPlanned"
      defaultMessage="{actual} of {planned}"
      values={{ actual: formatAmount(actual, locale), planned: formatAmount(planned, locale) }}
    />
  );
}

function ErrorState({
  store,
  onRetry,
}: {
  store: PlanDashboardStore;
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

/**
 * One plan's dashboard: data freshness, income / spent / net (incl. unplanned), planned
 * vs actual per category and item, and the caller's own unplanned transactions. Every
 * amount is in the plan's base currency unless it says "planned as".
 */
export const PlanDashboardView = observer(function PlanDashboardView({
  store,
  onRetry,
}: PlanDashboardViewProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const navigate = useNavigate();
  const { dashboard } = store;

  if (dashboard === null) {
    return (
      <>
        <ErrorState store={store} onRetry={onRetry} />
        {store.loading && <SkeletonList rows={5} rowHeight={64} />}
      </>
    );
  }

  const isEmpty = dashboard.income.length === 0 && dashboard.expense.length === 0;
  const period = [
    formatIsoDate(dashboard.periodStart, intl.locale),
    formatIsoDate(dashboard.periodEnd, intl.locale),
  ].join(' – ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
      <ErrorState store={store} onRetry={onRetry} />

      <header
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.md }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1
            style={{
              margin: 0,
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.semibold,
              color: theme.color.text.primary,
            }}
          >
            {dashboard.planName}
          </h1>
          <span
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: theme.space.sm,
              fontSize: theme.fontSize.xs,
              color: theme.color.text.secondary,
            }}
          >
            <span>{period}</span>
            <span>
              {dashboard.planType === 'household' ? (
                <FormattedMessage
                  id="planDashboard.type.household"
                  defaultMessage="Household plan"
                />
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
          </span>
        </div>
        <span
          role="status"
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.color.text.secondary,
            border: `1px solid ${theme.color.border.strong}`,
            borderRadius: theme.radius.pill,
            padding: `${String(theme.space.xs)}px ${String(theme.space.md)}px`,
            whiteSpace: 'nowrap',
          }}
        >
          <FormattedMessage
            id="planDashboard.asOf"
            defaultMessage="Data as of {date}"
            values={{ date: formatIsoDate(dashboard.asOf, intl.locale) }}
          />
        </span>
      </header>

      <Summary dashboard={dashboard} />

      {isEmpty && (
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
              void navigate(`/plans/${dashboard.planId}`);
            },
          }}
        />
      )}

      {dashboard.income.length > 0 && (
        <Section
          title={<FormattedMessage id="planDashboard.section.income" defaultMessage="Income" />}
          total={amountOfPlanned(
            dashboard.totals.actualIncome,
            dashboard.totals.plannedIncome,
            intl.locale,
          )}
          groups={dashboard.income}
        />
      )}
      {dashboard.expense.length > 0 && (
        <Section
          title={<FormattedMessage id="planDashboard.section.expenses" defaultMessage="Expenses" />}
          total={amountOfPlanned(
            dashboard.totals.actualExpenses,
            dashboard.totals.plannedExpenses,
            intl.locale,
          )}
          groups={dashboard.expense}
        />
      )}

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.space.md,
          padding: theme.space.lg,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.color.surface.raised,
          border: `1px solid ${theme.color.border.subtle}`,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
          }}
        >
          <FormattedMessage id="planDashboard.section.unplanned" defaultMessage="Unplanned" />
        </h2>
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
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
        </span>
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
      </section>
    </div>
  );
});
