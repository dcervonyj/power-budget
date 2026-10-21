import React, { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { formatMoney, parseMinorUnits } from '@power-budget/core';
import type { HouseholdDashboardCategoryDto } from '@power-budget/shared-app/contract';
import { useTheme } from '../ThemeContext.js';
import { toSupportedLocale } from '../../i18n/supportedLocale.js';
import type { HouseholdCategoryStore } from '../../../application/household/HouseholdCategoryStore.js';

export interface HouseholdCategoryDrillInProps {
  store: HouseholdCategoryStore;
  householdId: string;
  planId: string;
  categoryId: string;
}

type CategoryLine = HouseholdDashboardCategoryDto;

/** Exact minor units (integer string) formatted with the currency's exponent. */
function TotalAmount({ category }: { category: CategoryLine }): React.JSX.Element {
  const intl = useIntl();

  return (
    <>
      {formatMoney(
        { amountMinor: parseMinorUnits(category.totalAmountMinor), currency: category.currency },
        toSupportedLocale(intl.locale),
      )}
    </>
  );
}

// ── Total-only view ──────────────────────────────────────────────────────────

function TotalView({ category }: { category: CategoryLine }): React.JSX.Element {
  const theme = useTheme();
  const accentColor = theme.color.status.success;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.space.md,
        padding: theme.space.xl,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        border: `2px solid ${accentColor}`,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: accentColor,
        }}
      >
        <FormattedMessage
          id="component.household.privacy.level.total"
          defaultMessage="Summary only"
        />
      </span>

      <span
        style={{
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="component.household.privacy.total" defaultMessage="Total spend" />
      </span>

      <span
        style={{
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.semibold,
          color: accentColor,
        }}
      >
        <TotalAmount category={category} />
      </span>
    </div>
  );
}

// ── Total + count view ───────────────────────────────────────────────────────

function TotalAndCountView({ category }: { category: CategoryLine }): React.JSX.Element {
  const theme = useTheme();
  const accentColor = theme.color.status.warning;
  const count = category.transactionCount;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.md,
        padding: theme.space.xl,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        border: `2px solid ${accentColor}`,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.xs,
          fontWeight: theme.fontWeight.medium,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: accentColor,
        }}
      >
        <FormattedMessage
          id="component.household.privacy.level.totalAndCount"
          defaultMessage="Summary + count"
        />
      </span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
          <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
            <FormattedMessage id="component.household.privacy.total" defaultMessage="Total spend" />
          </span>
          <span
            style={{
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.semibold,
              color: theme.color.text.primary,
            }}
          >
            <TotalAmount category={category} />
          </span>
        </div>

        <span
          style={{
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.medium,
            padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
            borderRadius: theme.radius.pill,
            backgroundColor: `${accentColor}33`,
            color: accentColor,
            flexShrink: 0,
          }}
        >
          <FormattedMessage
            id="component.household.privacy.totalAndCount"
            defaultMessage="{count, plural, one {# transaction} other {# transactions}}"
            values={{ count }}
          />
        </span>
      </div>
    </div>
  );
}

// ── Full detail view ─────────────────────────────────────────────────────────

function FullDetailView({ category }: { category: CategoryLine }): React.JSX.Element {
  const theme = useTheme();
  const accentColor = theme.color.accent.default;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.md,
        padding: theme.space.xl,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        border: `2px solid ${accentColor}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: accentColor,
          }}
        >
          <FormattedMessage
            id="component.household.privacy.level.fullDetail"
            defaultMessage="Full detail"
          />
        </span>

        <span
          style={{
            fontSize: theme.fontSize.md,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
          }}
        >
          <TotalAmount category={category} />
        </span>
      </div>

      {/* The dashboard has no per-transaction lines yet (no category transactions endpoint). */}
      <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
        <FormattedMessage
          id="component.household.privacy.totalAndCount"
          defaultMessage="{count, plural, one {# transaction} other {# transactions}}"
          values={{ count: category.transactionCount }}
        />
      </span>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export const HouseholdCategoryDrillIn = observer(function HouseholdCategoryDrillIn({
  store,
  householdId,
  planId,
  categoryId,
}: HouseholdCategoryDrillInProps): React.JSX.Element {
  const theme = useTheme();

  useEffect(() => {
    void store.fetchCategory(householdId, planId, categoryId);
  }, [store, householdId, planId, categoryId]);

  if (store.loading) {
    return (
      <div
        style={{
          padding: theme.space.xl,
          color: theme.color.text.secondary,
          fontSize: theme.fontSize.md,
        }}
      >
        <FormattedMessage id="component.household.loading" defaultMessage="Loading..." />
      </div>
    );
  }

  if (store.error !== null) {
    return (
      <div
        style={{
          padding: theme.space.xl,
          color: theme.color.status.danger,
          fontSize: theme.fontSize.md,
        }}
      >
        {store.error === 'not_found' ? (
          <FormattedMessage
            id="component.household.notFound"
            defaultMessage="This category is not in the plan"
          />
        ) : store.error === 'fx_unavailable' ? (
          <FormattedMessage
            id="common.fxRateUnavailable"
            defaultMessage="Exchange rates are not available right now. Please try again later."
          />
        ) : (
          <FormattedMessage
            id="component.household.error"
            defaultMessage="Failed to load category details"
          />
        )}
      </div>
    );
  }

  const { category } = store;

  if (category === null) {
    return <div />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
      <span
        style={{
          fontSize: theme.fontSize.lg,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        {category.categoryName}
      </span>

      <CategoryView category={category} />
    </div>
  );
});

function CategoryView({ category }: { category: CategoryLine }): React.JSX.Element {
  switch (category.privacyLevel) {
    case 'total_only':
      return <TotalView category={category} />;
    case 'total_with_counts':
      return <TotalAndCountView category={category} />;
    case 'full_detail':
      return <FullDetailView category={category} />;
  }
}
