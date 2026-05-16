import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';
import type { PlannedItemActual } from '../../../domain/dashboard/PlanActualsView.js';

export interface ExpenseSectionProps {
  items: PlannedItemActual[];
}

function ProgressBar({ pct, color }: { pct: number; color: string }): React.JSX.Element {
  const theme = useTheme();
  const displayPct = Math.min(Math.max(pct, 0), 100);
  return (
    <div
      style={{
        height: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.border.subtle,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${String(displayPct)}%`,
          backgroundColor: color,
          borderRadius: theme.radius.pill,
        }}
      />
    </div>
  );
}

function expenseBarColor(pct: number, theme: ReturnType<typeof useTheme>): string {
  if (pct > 100) return theme.color.status.danger;
  if (pct >= 80) return theme.color.status.warning;
  return theme.color.status.success;
}

export const ExpenseSection = observer(function ExpenseSection({
  items,
}: ExpenseSectionProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const expenseItems = items.filter((item) => item.direction === 'expense');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.sm,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        padding: theme.space.lg,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="screen.dashboard.expenses" defaultMessage="Expenses" />
      </span>

      {expenseItems.length === 0 && (
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.muted }}>
          <FormattedMessage id="screen.dashboard.noPlan" defaultMessage="No active plan" />
        </span>
      )}

      {expenseItems.map((item) => {
        const pct = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
        const barColor = expenseBarColor(pct, theme);
        const plannedLabel = intl.formatMessage({
          id: 'screen.dashboard.planned',
          defaultMessage: 'Planned',
        });
        const actualLabel = intl.formatMessage({
          id: 'screen.dashboard.actual',
          defaultMessage: 'Actual',
        });

        const formattedActual = intl.formatNumber(item.actual / 100, {
          style: 'currency',
          currency: item.currency,
          maximumFractionDigits: 2,
        });
        const formattedPlanned = intl.formatNumber(item.planned / 100, {
          style: 'currency',
          currency: item.currency,
          maximumFractionDigits: 2,
        });
        const actualText = [actualLabel, formattedActual].join(': ');
        const titleText = [plannedLabel, formattedPlanned].join(': ');

        return (
          <div
            key={item.id}
            style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.primary }}>
                {item.category}
              </span>
              <span style={{ fontSize: theme.fontSize.xs, color: barColor }} title={titleText}>
                {actualText}
              </span>
            </div>
            <ProgressBar pct={pct} color={barColor} />
          </div>
        );
      })}
    </div>
  );
});
