import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../ThemeContext.js';

export interface LeftoverBucketProps {
  leftoverMinor: number;
  currency: string;
}

export const LeftoverBucket = observer(function LeftoverBucket({
  leftoverMinor,
  currency,
}: LeftoverBucketProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const isPositive = leftoverMinor >= 0;
  const amountColor = isPositive ? theme.color.status.success : theme.color.status.danger;

  const formattedAmount = intl.formatNumber(leftoverMinor / 100, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });

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
      <span
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="screen.dashboard.leftover" defaultMessage="Leftover" />
      </span>
      <span
        style={{
          fontSize: theme.fontSize.lg,
          fontWeight: theme.fontWeight.bold,
          color: amountColor,
        }}
        aria-label={formattedAmount}
      >
        {formattedAmount}
      </span>
    </div>
  );
});
