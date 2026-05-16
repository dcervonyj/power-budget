import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';
import type { PlannedItemActual } from '../../../domain/dashboard/PlanActualsView.js';

export interface IncomeSectionProps {
  items: PlannedItemActual[];
}

function ProgressBar({ pct, color }: { pct: number; color: string }): React.JSX.Element {
  const theme = useTheme();
  const clamped = Math.min(Math.max(pct, 0), 100);
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
          width: `${String(clamped)}%`,
          backgroundColor: color,
          borderRadius: theme.radius.pill,
        }}
      />
    </div>
  );
}

export const IncomeSection = observer(function IncomeSection({
  items,
}: IncomeSectionProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const incomeItems = items.filter((item) => item.direction === 'income');

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
        <FormattedMessage id="screen.dashboard.income" defaultMessage="Income" />
      </span>

      {incomeItems.length === 0 && (
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.muted }}>
          <FormattedMessage id="screen.dashboard.noPlan" defaultMessage="No active plan" />
        </span>
      )}

      {incomeItems.map((item) => {
        const pct = item.planned > 0 ? (item.actual / item.planned) * 100 : 0;
        const barColor =
          item.actual >= item.planned ? theme.color.status.success : theme.color.text.secondary;
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
              <span
                style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}
                title={titleText}
              >
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
