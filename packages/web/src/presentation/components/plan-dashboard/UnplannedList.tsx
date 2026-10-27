import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { Button } from '../Button.js';
import { AmountText } from '../../glass/atoms/AmountText.js';
import { Icon } from '../../glass/atoms/Icon.js';
import { formatIsoDate } from '../../i18n/formatAmount.js';
import type { UnplannedList as UnplannedListState } from '../../../application/dashboard/PlanDashboardStore.js';
import type { LineDirection, MoneyAmount } from '../../../domain/dashboard/PlanDashboard.js';
import { DIM_TEXT_STYLE, LIST_RESET_STYLE } from './overviewStyles.js';

export interface UnplannedListProps {
  readonly direction: LineDirection;
  readonly total: MoneyAmount;
  readonly list: UnplannedListState;
  readonly onLoadMore: () => void;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '9px 0',
  fontSize: 'var(--pb-glass-type-body-web)',
};

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
  const intl = useIntl();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xs)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          ...DIM_TEXT_STYLE,
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
        <span style={{ color: 'var(--pb-glass-fg)', fontWeight: 600 }}>
          <AmountText amount={total} />
        </span>
      </div>

      {list.items.length > 0 && (
        <ul style={LIST_RESET_STYLE}>
          {list.items.map((tx, index) => (
            <li
              key={tx.id}
              style={{
                ...ROW_STYLE,
                boxShadow: index === 0 ? 'none' : 'inset 0 1px 0 var(--pb-glass-sep)',
              }}
            >
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {tx.description}
                <span style={{ ...DIM_TEXT_STYLE, marginLeft: '0.3em' }}>
                  <FormattedMessage
                    id="overview.unplanned.date"
                    defaultMessage="· {date}"
                    values={{ date: formatIsoDate(tx.occurredOn, intl.locale) }}
                  />
                </span>
              </span>
              <AmountText amount={tx.amount} />
            </li>
          ))}
        </ul>
      )}

      {list.items.length === 0 && !list.loading && !list.failed && (
        <span style={DIM_TEXT_STYLE}>
          <FormattedMessage
            id="planDashboard.unplanned.noneOwn"
            defaultMessage="None of your own transactions"
          />
        </span>
      )}

      {list.failed && (
        <span
          role="alert"
          style={{
            ...DIM_TEXT_STYLE,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--pb-glass-over)',
          }}
        >
          <Icon name="warning" size={16} />
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
