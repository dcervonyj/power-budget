import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';
import type { PlanActualsView } from '../../../domain/dashboard/PlanActualsView.js';

export interface PlanHeaderProps {
  actuals: PlanActualsView;
}

type HealthStatus = 'good' | 'warning' | 'danger';

function computeHealth(actuals: PlanActualsView): HealthStatus {
  const { totalExpensePlanned, totalExpenseActual } = actuals;
  if (totalExpensePlanned === 0) return 'good';
  const pct = (totalExpenseActual / totalExpensePlanned) * 100;
  if (pct > 100) return 'danger';
  if (pct >= 80) return 'warning';
  return 'good';
}

function healthMessageId(status: HealthStatus): string {
  switch (status) {
    case 'good':
      return 'component.dashboard.health.good';
    case 'warning':
      return 'component.dashboard.health.warning';
    case 'danger':
      return 'component.dashboard.health.danger';
  }
}

export const PlanHeader = observer(function PlanHeader({
  actuals,
}: PlanHeaderProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const health = computeHealth(actuals);

  const periodText = [
    intl.formatDate(actuals.periodStart, { year: 'numeric', month: 'long', day: 'numeric' }),
    intl.formatDate(actuals.periodEnd, { year: 'numeric', month: 'long', day: 'numeric' }),
  ].join(' \u2013 ');

  const healthColor =
    health === 'good'
      ? theme.color.status.success
      : health === 'warning'
        ? theme.color.status.warning
        : theme.color.status.danger;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.space.lg,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        gap: theme.space.md,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
        <span
          style={{
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
          }}
        >
          {actuals.planName}
        </span>
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
          {periodText}
        </span>
      </div>

      <span
        style={{
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
          padding: `${String(theme.space.xs)}px ${String(theme.space.sm)}px`,
          borderRadius: theme.radius.pill,
          backgroundColor: `${healthColor}33`,
          color: healthColor,
          flexShrink: 0,
        }}
      >
        <FormattedMessage id={healthMessageId(health)} defaultMessage={health} />
      </span>
    </div>
  );
});
