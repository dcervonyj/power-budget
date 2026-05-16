import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';
import type { DashboardStore } from '../../../application/dashboard/DashboardStore.js';
import type { PlanActualsView } from '../../../domain/dashboard/PlanActualsView.js';

export interface BottomLineProps {
  store: DashboardStore;
  actuals: PlanActualsView;
}

export const BottomLine = observer(function BottomLine({
  store,
  actuals,
}: BottomLineProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const convertedMinor = store.convertAmount(actuals.leftover, actuals.currency);
  const displayCurrency = store.displayCurrency || actuals.currency;

  const formattedNet = intl.formatNumber(convertedMinor / 100, {
    style: 'currency',
    currency: displayCurrency,
    maximumFractionDigits: 2,
  });

  const isPositive = convertedMinor >= 0;
  const amountColor = isPositive ? theme.color.status.success : theme.color.status.danger;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.space.lg,
        backgroundColor: theme.color.surface.mid,
        borderRadius: theme.radius.lg,
        gap: theme.space.md,
        border: `1px solid ${theme.color.border.strong}`,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="screen.dashboard.bottomLine" defaultMessage="Net Balance" />
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm }}>
        <span
          style={{
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.bold,
            color: amountColor,
          }}
          aria-label={formattedNet}
        >
          {formattedNet}
        </span>
        <button
          type="button"
          onClick={() => {
            store.cycleCurrency();
          }}
          title={intl.formatMessage({
            id: 'screen.dashboard.bottomLine.switchCurrency',
            defaultMessage: 'Switch currency',
          })}
          aria-label={intl.formatMessage({
            id: 'screen.dashboard.bottomLine.switchCurrency',
            defaultMessage: 'Switch currency',
          })}
          style={{
            padding: `${String(theme.space.xs)}px ${String(theme.space.sm)}px`,
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.color.border.subtle}`,
            backgroundColor: theme.color.surface.raised,
            color: theme.color.text.secondary,
            fontSize: theme.fontSize.sm,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {displayCurrency}
        </button>
      </div>
    </div>
  );
});
