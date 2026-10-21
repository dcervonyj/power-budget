import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { parseMinorUnits } from '@power-budget/core';
import type {
  CategoryPrivacyDto,
  HouseholdDashboardCategoryDto,
} from '@power-budget/shared-app/contract';
import { useTheme } from '../ThemeContext.js';
import { Select } from '../Select.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import type { HouseholdStore } from '../../../application/household/HouseholdStore.js';

export interface HouseholdAggregatesCardProps {
  readonly store: HouseholdStore;
}

function PrivacyChip({ level }: { level: CategoryPrivacyDto }): React.JSX.Element {
  const theme = useTheme();
  const color =
    level === 'full_detail'
      ? theme.color.status.success
      : level === 'total_with_counts'
        ? theme.color.accent.default
        : theme.color.text.secondary;

  return (
    <span
      style={{
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.semibold,
        color,
        border: `1px solid ${color}`,
        borderRadius: theme.radius.pill,
        padding: `2px ${String(theme.space.sm)}px`,
        whiteSpace: 'nowrap',
      }}
    >
      <PrivacyLabel level={level} />
    </span>
  );
}

function PrivacyLabel({ level }: { level: CategoryPrivacyDto }): React.JSX.Element {
  switch (level) {
    case 'full_detail':
      return <FormattedMessage id="household.privacy.fullDetail" defaultMessage="Full detail" />;
    case 'total_with_counts':
      return (
        <FormattedMessage id="household.privacy.totalWithCounts" defaultMessage="Total + count" />
      );
    case 'total_only':
      return <FormattedMessage id="household.privacy.totalOnly" defaultMessage="Total only" />;
  }
}

/**
 * total_only: only the sum (the count would reveal the partner's activity);
 * total_with_counts: sum and count; full_detail: sum, count and a link to details.
 */
function CategoryRow({
  category,
  householdPlanId,
}: {
  category: HouseholdDashboardCategoryDto;
  householdPlanId: string;
}): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const total = formatAmount(
    { amountMinor: parseMinorUnits(category.totalAmountMinor), currency: category.currency },
    intl.locale,
  );

  return (
    <li
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.md,
        padding: `${String(theme.space.sm)}px 0`,
        borderTop: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 140,
          fontSize: theme.fontSize.sm,
          color: theme.color.text.primary,
        }}
      >
        {category.categoryName}
      </span>
      <PrivacyChip level={category.privacyLevel} />
      <span
        style={{
          minWidth: 140,
          textAlign: 'right',
          fontSize: theme.fontSize.xs,
          color: theme.color.text.secondary,
        }}
      >
        {category.privacyLevel === 'total_only' ? (
          <FormattedMessage
            id="household.aggregates.detailsHidden"
            defaultMessage="Details hidden"
          />
        ) : (
          <FormattedMessage
            id="household.aggregates.count"
            defaultMessage="{count, plural, one {# transaction} other {# transactions}}"
            values={{ count: category.transactionCount }}
          />
        )}
      </span>
      <span
        style={{
          minWidth: 120,
          textAlign: 'right',
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.semibold,
          fontVariantNumeric: 'tabular-nums',
          color: theme.color.text.primary,
        }}
      >
        {total}
      </span>
      {category.privacyLevel === 'full_detail' && (
        <Link
          to={`/household?planId=${encodeURIComponent(householdPlanId)}&categoryId=${encodeURIComponent(category.categoryId)}`}
          style={{ fontSize: theme.fontSize.xs, color: theme.color.accent.default }}
        >
          <FormattedMessage id="household.aggregates.details" defaultMessage="Details" />
        </Link>
      )}
    </li>
  );
}

/** Both members' totals per category of a household plan, as privacy allows. */
export const HouseholdAggregatesCard = observer(function HouseholdAggregatesCard({
  store,
}: HouseholdAggregatesCardProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const planId = store.selectedPlanId;

  return (
    <section
      aria-labelledby="household-aggregates-title"
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
        id="household-aggregates-title"
        style={{
          margin: 0,
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="household.aggregates.title" defaultMessage="Shared spending" />
      </h2>
      <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
        <FormattedMessage
          id="household.aggregates.explainer"
          defaultMessage="Totals include both of you. Your partner's transactions are shown as each category's privacy level allows; accounts and balances are never shared."
        />
      </span>

      {store.householdPlans.length === 0 && (
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
          <FormattedMessage
            id="household.aggregates.noPlan"
            defaultMessage="No household plan yet. Create a plan of type Household to see shared totals."
          />
          <Link
            to="/plans"
            style={{ color: theme.color.accent.default, marginLeft: theme.space.xs }}
          >
            <FormattedMessage id="household.aggregates.toPlans" defaultMessage="Go to plans" />
          </Link>
        </span>
      )}

      {store.householdPlans.length > 1 && (
        <Select<string>
          id="household-plan"
          label={intl.formatMessage({ id: 'household.aggregates.plan', defaultMessage: 'Plan' })}
          options={store.householdPlans.map((plan) => ({ value: plan.id, label: plan.name }))}
          value={planId ?? ''}
          onChange={(value) => {
            void store.selectPlan(value);
          }}
        />
      )}
      {store.householdPlans.length === 1 && (
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.primary }}>
          {store.householdPlans[0]?.name}
        </span>
      )}

      {store.aggregatesError === 'fx_unavailable' && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="common.fxRateUnavailable"
              defaultMessage="Exchange rates are not available right now. Please try again later."
            />
          }
          onRetry={() => {
            if (planId !== null) {
              void store.selectPlan(planId);
            }
          }}
        />
      )}
      {store.aggregatesError === 'failed' && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="household.aggregates.failed"
              defaultMessage="Shared totals could not be loaded."
            />
          }
          onRetry={() => {
            if (planId !== null) {
              void store.selectPlan(planId);
            }
          }}
        />
      )}

      {planId !== null && store.aggregatesError === null && !store.aggregatesLoading && (
        <>
          {store.categories.length === 0 ? (
            <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
              <FormattedMessage
                id="household.aggregates.empty"
                defaultMessage="No transactions in this plan's period yet."
              />
            </span>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {store.categories.map((category) => (
                <CategoryRow
                  key={category.categoryId}
                  category={category}
                  householdPlanId={planId}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
});
