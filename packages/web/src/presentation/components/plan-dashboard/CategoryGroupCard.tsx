import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { Theme } from '@power-budget/design-tokens';
import { useTheme } from '../ThemeContext.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import type {
  DashboardCategoryGroup,
  DashboardLine,
  LineDirection,
  MoneyAmount,
  ProgressBand,
} from '../../../domain/dashboard/PlanDashboard.js';

export interface CategoryGroupCardProps {
  readonly group: DashboardCategoryGroup;
}

/** Share of the plan reached, 0..100 for the bar; a zero plan with spend is full. */
export function progressPercent(planned: MoneyAmount, actual: MoneyAmount): number {
  if (planned.amountMinor <= 0n) {
    return actual.amountMinor > 0n ? 100 : 0;
  }
  const pct = Number((actual.amountMinor * 100n) / planned.amountMinor);

  return Math.min(Math.max(pct, 0), 100);
}

/** Expenses: ok is good, over is bad. Income: reaching the plan ("over") is good. */
export function bandColor(theme: Theme, direction: LineDirection, band: ProgressBand): string {
  if (direction === 'income') {
    return band === 'over' ? theme.color.status.success : theme.color.income.default;
  }
  switch (band) {
    case 'ok':
      return theme.color.status.success;
    case 'warning':
      return theme.color.status.warning;
    case 'over':
      return theme.color.status.danger;
  }
}

function BandLabel({
  direction,
  band,
}: {
  direction: LineDirection;
  band: ProgressBand;
}): React.JSX.Element {
  if (direction === 'income') {
    return band === 'over' ? (
      <FormattedMessage id="planDashboard.band.received" defaultMessage="Received" />
    ) : (
      <FormattedMessage id="planDashboard.band.expected" defaultMessage="Expected" />
    );
  }
  switch (band) {
    case 'ok':
      return <FormattedMessage id="planDashboard.band.ok" defaultMessage="On track" />;
    case 'warning':
      return <FormattedMessage id="planDashboard.band.warning" defaultMessage="Near limit" />;
    case 'over':
      return <FormattedMessage id="planDashboard.band.over" defaultMessage="Over budget" />;
  }
}

function RemainingText({
  direction,
  remaining,
}: {
  direction: LineDirection;
  remaining: MoneyAmount;
}): React.JSX.Element {
  const intl = useIntl();
  const absolute = {
    amountMinor: remaining.amountMinor < 0n ? -remaining.amountMinor : remaining.amountMinor,
    currency: remaining.currency,
  };
  const amount = formatAmount(absolute, intl.locale);
  if (direction === 'income') {
    return remaining.amountMinor > 0n ? (
      <FormattedMessage
        id="planDashboard.remaining.toCome"
        defaultMessage="{amount} still expected"
        values={{ amount }}
      />
    ) : (
      <FormattedMessage
        id="planDashboard.remaining.fullyReceived"
        defaultMessage="Fully received"
      />
    );
  }

  return remaining.amountMinor >= 0n ? (
    <FormattedMessage
      id="planDashboard.remaining.left"
      defaultMessage="{amount} left"
      values={{ amount }}
    />
  ) : (
    <FormattedMessage
      id="planDashboard.remaining.over"
      defaultMessage="{amount} over plan"
      values={{ amount }}
    />
  );
}

function ProgressBar({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}): React.JSX.Element {
  const theme = useTheme();

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      style={{
        height: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.border.strong,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${String(pct)}%`,
          backgroundColor: color,
          borderRadius: theme.radius.pill,
        }}
      />
    </div>
  );
}

function ItemRow({ line, index }: { line: DashboardLine; index: number }): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  return (
    <li
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: theme.space.md,
        fontSize: theme.fontSize.xs,
        color: theme.color.text.secondary,
        padding: `${String(theme.space.xs)}px 0`,
        borderTop: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <span>
        {line.note !== '' ? (
          line.note
        ) : (
          <FormattedMessage
            id="planDashboard.item.untitled"
            defaultMessage="Item {number}"
            values={{ number: index + 1 }}
          />
        )}
        {line.original !== null && (
          <span style={{ marginLeft: theme.space.sm }}>
            <FormattedMessage
              id="planDashboard.item.plannedAs"
              defaultMessage="planned as {amount}"
              values={{ amount: formatAmount(line.original, intl.locale) }}
            />
          </span>
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

/** One category: name, status, bar, actual of planned, what is left, and its items. */
export function CategoryGroupCard({ group }: CategoryGroupCardProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const color = bandColor(theme, group.direction, group.band);
  const isOver = group.direction === 'expense' && group.band === 'over';
  const name =
    group.categoryName !== ''
      ? group.categoryName
      : intl.formatMessage({
          id: 'planDashboard.category.unknown',
          defaultMessage: 'Uncategorised',
        });
  const single = group.lines.length === 1 ? group.lines[0] : undefined;

  return (
    <article
      aria-label={name}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.sm,
        padding: theme.space.md,
        borderRadius: theme.radius.md,
        backgroundColor: isOver ? `${theme.color.status.danger}0d` : theme.color.surface.mid,
        borderLeft: `3px solid ${isOver ? theme.color.status.danger : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.space.sm }}>
        <span
          style={{
            flex: 1,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            color: theme.color.text.primary,
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.semibold,
            color,
            whiteSpace: 'nowrap',
          }}
        >
          <BandLabel direction={group.direction} band={group.band} />
        </span>
      </div>
      <ProgressBar
        pct={progressPercent(group.planned, group.actual)}
        color={color}
        label={intl.formatMessage(
          { id: 'planDashboard.progressLabel', defaultMessage: 'Progress of {name}' },
          { name },
        )}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: theme.space.md,
          fontSize: theme.fontSize.xs,
          color: theme.color.text.secondary,
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums', color: theme.color.text.primary }}>
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
          <RemainingText direction={group.direction} remaining={group.remaining} />
        </span>
      </div>
      {single !== undefined && single.original !== null && (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
          <FormattedMessage
            id="planDashboard.item.plannedAs"
            defaultMessage="planned as {amount}"
            values={{ amount: formatAmount(single.original, intl.locale) }}
          />
        </span>
      )}
      {single === undefined && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {group.lines.map((line, index) => (
            <ItemRow key={line.plannedItemId} line={line} index={index} />
          ))}
        </ul>
      )}
    </article>
  );
}
