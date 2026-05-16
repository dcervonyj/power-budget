import React, { useEffect } from 'react';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';
import type { HouseholdCategoryStore } from '../../../application/household/HouseholdCategoryStore.js';
import type {
  CategoryAggregate,
  TransactionSummary,
} from '../../../domain/household/CategoryAggregate.js';

export interface HouseholdCategoryDrillInProps {
  store: HouseholdCategoryStore;
  categoryId: string;
}

// ── Total-only view ──────────────────────────────────────────────────────────

function TotalView({ aggregate }: { aggregate: CategoryAggregate }): React.JSX.Element {
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
        <FormattedNumber
          value={aggregate.totalMinor / 100}
          style="currency"
          currency={aggregate.currency}
          maximumFractionDigits={2}
        />
      </span>
    </div>
  );
}

// ── Total + count view ───────────────────────────────────────────────────────

function TotalAndCountView({ aggregate }: { aggregate: CategoryAggregate }): React.JSX.Element {
  const theme = useTheme();
  const accentColor = theme.color.status.warning;
  const count = aggregate.transactionCount ?? 0;

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
            <FormattedNumber
              value={aggregate.totalMinor / 100}
              style="currency"
              currency={aggregate.currency}
              maximumFractionDigits={2}
            />
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

function TransactionRow({
  tx,
  currency,
}: {
  tx: TransactionSummary;
  currency: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <tr>
      <td
        style={{
          padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
          fontSize: theme.fontSize.sm,
          color: theme.color.text.secondary,
          borderBottom: `1px solid ${theme.color.border.subtle}`,
          whiteSpace: 'nowrap',
        }}
      >
        {tx.date}
      </td>
      <td
        style={{
          padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
          fontSize: theme.fontSize.sm,
          color: theme.color.text.primary,
          borderBottom: `1px solid ${theme.color.border.subtle}`,
          width: '100%',
        }}
      >
        {tx.description}
      </td>
      <td
        style={{
          padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          color: theme.color.text.primary,
          borderBottom: `1px solid ${theme.color.border.subtle}`,
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        <FormattedNumber
          value={tx.amountMinor / 100}
          style="currency"
          currency={currency}
          maximumFractionDigits={2}
        />
      </td>
    </tr>
  );
}

function FullDetailView({ aggregate }: { aggregate: CategoryAggregate }): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const accentColor = theme.color.accent.default;
  const transactions = aggregate.transactions ?? [];

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
          <FormattedNumber
            value={aggregate.totalMinor / 100}
            style="currency"
            currency={aggregate.currency}
            maximumFractionDigits={2}
          />
        </span>
      </div>

      <span
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage
          id="component.household.privacy.fullDetail"
          defaultMessage="Transaction details"
        />
      </span>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                style={{
                  padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.medium,
                  color: theme.color.text.secondary,
                  textAlign: 'left',
                  borderBottom: `2px solid ${theme.color.border.subtle}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {intl.formatMessage({ id: 'component.household.date', defaultMessage: 'Date' })}
              </th>
              <th
                style={{
                  padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.medium,
                  color: theme.color.text.secondary,
                  textAlign: 'left',
                  borderBottom: `2px solid ${theme.color.border.subtle}`,
                }}
              >
                {intl.formatMessage({
                  id: 'component.household.description',
                  defaultMessage: 'Description',
                })}
              </th>
              <th
                style={{
                  padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.medium,
                  color: theme.color.text.secondary,
                  textAlign: 'right',
                  borderBottom: `2px solid ${theme.color.border.subtle}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {intl.formatMessage({ id: 'component.household.amount', defaultMessage: 'Amount' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} currency={aggregate.currency} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export const HouseholdCategoryDrillIn = observer(function HouseholdCategoryDrillIn({
  store,
  categoryId,
}: HouseholdCategoryDrillInProps): React.JSX.Element {
  const theme = useTheme();

  useEffect(() => {
    void store.fetchAggregate(categoryId);
  }, [store, categoryId]);

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
        <FormattedMessage
          id="component.household.error"
          defaultMessage="Failed to load category details"
        />
      </div>
    );
  }

  const { aggregate } = store;

  if (aggregate === null) {
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
        {aggregate.categoryName}
      </span>

      {aggregate.privacyLevel === 'total' && <TotalView aggregate={aggregate} />}
      {aggregate.privacyLevel === 'total_and_count' && <TotalAndCountView aggregate={aggregate} />}
      {aggregate.privacyLevel === 'full_detail' && <FullDetailView aggregate={aggregate} />}
    </div>
  );
});
