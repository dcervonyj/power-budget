import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.js';
import { Button } from '../Button.js';
import type { BankConnection } from '../../../domain/bank/BankConnection.js';

export interface ReconnectBannerProps {
  connections: BankConnection[];
}

export const ReconnectBanner = observer(function ReconnectBanner({
  connections,
}: ReconnectBannerProps): React.JSX.Element | null {
  const theme = useTheme();
  const intl = useIntl();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const now = Date.now();
  const threshold = now + 7 * 24 * 60 * 60 * 1000;
  const expiring = connections.filter(
    (c) => c.expiresAt !== null && c.expiresAt.getTime() < threshold,
  );

  if (dismissed || expiring.length === 0) {
    return null;
  }

  const first = expiring[0]!;
  const daysLeft = first.expiresAt
    ? Math.max(0, Math.ceil((first.expiresAt.getTime() - now) / 86_400_000))
    : 0;

  return (
    <div
      role="alert"
      style={{
        backgroundColor: theme.color.status.warning + '22',
        borderLeft: `4px solid ${theme.color.status.warning}`,
        borderRadius: theme.radius.md,
        padding: `${String(theme.space.sm)}px ${String(theme.space.lg)}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.md,
        flexWrap: 'wrap',
        marginBottom: theme.space.lg,
      }}
    >
      <span style={{ color: theme.color.text.primary, fontSize: theme.fontSize.sm }}>
        <FormattedMessage
          id="bankConnections.reconnectBanner"
          values={{ name: first.name, days: daysLeft }}
        />
      </span>
      <div style={{ display: 'flex', gap: theme.space.sm }}>
        <Button
          variant="primary"
          onClick={() => {
            void navigate('/bank-connections');
          }}
        >
          <FormattedMessage id="bankConnections.reconnect" />
        </Button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
          }}
          aria-label={intl.formatMessage({ id: 'common.dismiss', defaultMessage: 'Dismiss' })}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: theme.color.text.secondary,
            fontSize: theme.fontSize.lg,
            padding: 0,
            lineHeight: 1,
          }}
        >
          <FormattedMessage id="common.closeIcon" defaultMessage="×" />
        </button>
      </div>
    </div>
  );
});
