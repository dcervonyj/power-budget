import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { statusKind } from '@power-budget/shared-app';
import { isPaid } from '../../../application/dashboard/dashboardOverview.js';
import type {
  DashboardCategoryGroup,
  DashboardLine,
  MoneyAmount,
} from '../../../domain/dashboard/PlanDashboard.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import { CategoryRow } from '../../glass/rows/CategoryRow.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import { DIM_TEXT_STYLE, LIST_RESET_STYLE } from './overviewStyles.js';

export interface CategoryGroupCardProps {
  readonly group: DashboardCategoryGroup;
  /** Position in the list: staggers the rod entrance. */
  readonly index: number;
  /** At-this-pace forecast when it ends above the plan (current period only). */
  readonly forecast?: MoneyAmount;
}

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: '2px 12px',
  padding: '6px 0',
  boxShadow: 'inset 0 1px 0 var(--pb-glass-sep)',
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

const CARD_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
};

/** Share of the plan spent, rounded; a zero plan with spend counts as 100. */
export function spentPercent(planned: MoneyAmount, actual: MoneyAmount): number {
  if (planned.amountMinor <= 0n) {
    return actual.amountMinor > 0n ? 100 : 0;
  }

  return Number((actual.amountMinor * 100n + planned.amountMinor / 2n) / planned.amountMinor);
}

/**
 * One expense category: the D7 CategoryRow (light = money left, status words), its spent-of-plan
 * line and, when it has several items or one planned in another currency, the items.
 */
export function CategoryGroupCard({
  group,
  index,
  forecast,
}: CategoryGroupCardProps): React.JSX.Element {
  const name = useCategoryName(group);
  const paid = isPaid(group);

  return (
    <article aria-label={name} style={CARD_STYLE}>
      <CategoryRow
        index={index}
        category={{
          id: group.categoryId,
          label: name,
          spentMinor: group.actual.amountMinor,
          plannedMinor: group.planned.amountMinor,
          currency: group.actual.currency,
          status: statusKind(group.band, paid),
          paid,
          forecastMinor: forecast?.amountMinor,
        }}
      />
      <SpentOfPlanned group={group} />
      <GroupItems group={group} />
    </article>
  );
}

/** One income category: received of planned, and received / expected in words. */
export function IncomeGroupCard({ group }: { group: DashboardCategoryGroup }): React.JSX.Element {
  const name = useCategoryName(group);
  const intl = useIntl();
  const received = group.band === 'over';

  return (
    <article
      aria-label={name}
      style={{
        ...CARD_STYLE,
        gap: 'var(--pb-glass-space-sm)',
        padding: 'var(--pb-glass-space-md) var(--pb-glass-space-lg)',
        borderRadius: 'var(--pb-glass-radius-tile)',
        background: 'var(--pb-glass-clear)',
        boxShadow: 'var(--pb-glass-clear-rim)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 'var(--pb-glass-type-label-web)',
            fontWeight: 'var(--pb-glass-type-label-weight)',
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </span>
        <StatusTag
          kind={received ? 'ok' : 'neutral'}
          label={
            received
              ? intl.formatMessage({
                  id: 'planDashboard.band.received',
                  defaultMessage: 'Received',
                })
              : intl.formatMessage({
                  id: 'planDashboard.band.expected',
                  defaultMessage: 'Expected',
                })
          }
          icon={received ? 'check' : 'clock'}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: '2px 12px',
          ...DIM_TEXT_STYLE,
        }}
      >
        <span style={{ color: 'var(--pb-glass-fg)', fontVariantNumeric: 'tabular-nums' }}>
          <FormattedMessage
            id="planDashboard.amountOfPlanned"
            defaultMessage="{actual} of {planned}"
            values={{
              actual: formatAmount(group.actual, intl.locale),
              planned: formatAmount(group.planned, intl.locale),
            }}
          />
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <IncomeRemaining remaining={group.remaining} />
        </span>
      </div>
      <GroupItems group={group} />
    </article>
  );
}

function useCategoryName(group: DashboardCategoryGroup): string {
  const intl = useIntl();

  return group.categoryName !== ''
    ? group.categoryName
    : intl.formatMessage({ id: 'planDashboard.category.unknown', defaultMessage: 'Uncategorised' });
}

function SpentOfPlanned({ group }: { group: DashboardCategoryGroup }): React.JSX.Element {
  const intl = useIntl();

  return (
    <p style={{ ...DIM_TEXT_STYLE, padding: '0 var(--pb-glass-space-lg)' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        <FormattedMessage
          id="planDashboard.amountOfPlanned"
          defaultMessage="{actual} of {planned}"
          values={{
            actual: formatAmount(group.actual, intl.locale),
            planned: formatAmount(group.planned, intl.locale),
          }}
        />
      </span>
      <span style={{ marginLeft: '0.3em' }}>
        <FormattedMessage
          id="overview.category.percentSpent"
          defaultMessage="· {percent}% spent"
          values={{ percent: spentPercent(group.planned, group.actual) }}
        />
      </span>
    </p>
  );
}

function IncomeRemaining({ remaining }: { remaining: MoneyAmount }): React.JSX.Element {
  const intl = useIntl();
  if (remaining.amountMinor > 0n) {
    return (
      <FormattedMessage
        id="planDashboard.remaining.toCome"
        defaultMessage="{amount} still expected"
        values={{ amount: formatAmount(remaining, intl.locale) }}
      />
    );
  }

  return (
    <FormattedMessage id="planDashboard.remaining.fullyReceived" defaultMessage="Fully received" />
  );
}

/** The items of a category: shown when there are several, or one planned in another currency. */
function GroupItems({ group }: { group: DashboardCategoryGroup }): React.JSX.Element | null {
  const single = group.lines.length === 1 ? group.lines[0] : undefined;
  if (single !== undefined) {
    return single.original === null ? null : <PlannedAs line={single} padded />;
  }

  return (
    <ul style={{ ...LIST_RESET_STYLE, padding: '0 var(--pb-glass-space-lg)' }}>
      {group.lines.map((line, index) => (
        <ItemRow key={line.plannedItemId} line={line} index={index} />
      ))}
    </ul>
  );
}

function ItemRow({ line, index }: { line: DashboardLine; index: number }): React.JSX.Element {
  const intl = useIntl();

  return (
    <li style={ITEM_STYLE}>
      <span style={{ color: 'var(--pb-glass-fg)' }}>
        {line.note !== '' ? (
          line.note
        ) : (
          <FormattedMessage
            id="planDashboard.item.untitled"
            defaultMessage="Item {number}"
            values={{ number: index + 1 }}
          />
        )}
        {line.original === null ? null : (
          <>
            {' '}
            <PlannedAs line={line} padded={false} />
          </>
        )}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <FormattedMessage
          id="planDashboard.amountOfPlanned"
          defaultMessage="{actual} of {planned}"
          values={{
            actual: formatAmount(line.actual, intl.locale),
            planned: formatAmount(line.planned, intl.locale),
          }}
        />
      </span>
    </li>
  );
}

function PlannedAs({ line, padded }: { line: DashboardLine; padded: boolean }): React.JSX.Element {
  const intl = useIntl();
  const amount = line.original === null ? line.planned : line.original;

  return (
    <span
      style={{
        ...DIM_TEXT_STYLE,
        padding: padded ? '0 var(--pb-glass-space-lg)' : 0,
      }}
    >
      <FormattedMessage
        id="planDashboard.item.plannedAs"
        defaultMessage="planned as {amount}"
        values={{ amount: formatAmount(amount, intl.locale) }}
      />
    </span>
  );
}
