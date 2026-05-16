import React from 'react';
import { FormattedMessage } from 'react-intl';
import { useTheme } from './ThemeContext.js';

interface TransactionStatusBadgeProps {
  isTransfer: boolean;
  ignored: boolean;
}

export function TransactionStatusBadge({
  isTransfer,
  ignored,
}: TransactionStatusBadgeProps): React.JSX.Element | null {
  const theme = useTheme();
  if (!isTransfer && !ignored) return null;
  return (
    <div style={{ display: 'flex', gap: theme.space.xs, flexWrap: 'wrap' }}>
      {isTransfer && (
        <span
          style={{
            backgroundColor: theme.color.accent.default + '22',
            color: theme.color.accent.default,
            padding: `${theme.space.xs}px ${theme.space.sm}px`,
            borderRadius: theme.radius.sm,
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
          }}
        >
          <FormattedMessage id="transaction.badge.transfer" defaultMessage="Transfer" />
        </span>
      )}
      {ignored && (
        <span
          style={{
            backgroundColor: theme.color.status.danger + '22',
            color: theme.color.status.danger,
            padding: `${theme.space.xs}px ${theme.space.sm}px`,
            borderRadius: theme.radius.sm,
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.medium,
          }}
        >
          <FormattedMessage id="transaction.badge.ignored" defaultMessage="Ignored" />
        </span>
      )}
    </div>
  );
}
