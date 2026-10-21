import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';
import { Button } from '../Button.js';
import { formatAmount, formatIsoDate } from '../../i18n/formatAmount.js';
import type { UnplannedList as UnplannedListState } from '../../../application/dashboard/PlanDashboardStore.js';
import type { LineDirection, MoneyAmount } from '../../../domain/dashboard/PlanDashboard.js';

export interface UnplannedListProps {
  readonly direction: LineDirection;
  readonly total: MoneyAmount;
  readonly list: UnplannedListState;
  readonly onLoadMore: () => void;
}

/**
 * The caller's own transactions with no planned item, in their own currency. The
 * total is in the plan's base currency and includes a partner's (CLN-012 privacy).
 */
export const UnplannedList = observer(function UnplannedList({
  direction,
  total,
  list,
  onLoadMore,
}: UnplannedListProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const totalText = formatAmount(total, intl.locale);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: theme.space.md,
          fontSize: theme.fontSize.sm,
          color: theme.color.text.primary,
        }}
      >
        <span>
          {direction === 'expense' ? (
            <FormattedMessage
              id="planDashboard.unplanned.spent"
              defaultMessage="Spent outside the plan"
            />
          ) : (
            <FormattedMessage
              id="planDashboard.unplanned.received"
              defaultMessage="Received outside the plan"
            />
          )}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: theme.fontWeight.semibold }}>
          {totalText}
        </span>
      </div>

      {list.items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.items.map((tx) => (
            <li
              key={tx.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: theme.space.md,
                padding: `${String(theme.space.xs)}px 0`,
                borderTop: `1px solid ${theme.color.border.subtle}`,
                fontSize: theme.fontSize.xs,
              }}
            >
              <span style={{ color: theme.color.text.primary }}>
                {tx.description}
                <span style={{ color: theme.color.text.secondary, marginLeft: theme.space.sm }}>
                  {formatIsoDate(tx.occurredOn, intl.locale)}
                </span>
              </span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  color: theme.color.text.primary,
                }}
              >
                {formatAmount(tx.amount, intl.locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {list.items.length === 0 && !list.loading && !list.failed && (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
          <FormattedMessage
            id="planDashboard.unplanned.noneOwn"
            defaultMessage="None of your own transactions"
          />
        </span>
      )}

      {list.failed && (
        <span
          role="alert"
          style={{ fontSize: theme.fontSize.xs, color: theme.color.status.danger }}
        >
          <FormattedMessage
            id="planDashboard.unplanned.failed"
            defaultMessage="The list could not be loaded."
          />
        </span>
      )}

      {(list.nextCursor !== null || list.failed) && (
        <div>
          <Button variant="secondary" loading={list.loading} onClick={onLoadMore}>
            {list.failed ? (
              <FormattedMessage id="common.retry" defaultMessage="Retry" />
            ) : (
              <FormattedMessage id="planDashboard.unplanned.more" defaultMessage="Show more" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
});
