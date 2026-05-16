import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../ThemeContext.js';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';

export const BankSyncFailureBanner = observer(
  function BankSyncFailureBanner(): React.JSX.Element | null {
    const theme = useTheme();
    const intl = useIntl();
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(false);

    const failed = bankConnectionStore.connections.filter((c) => c.status === 'error');

    if (dismissed || failed.length === 0) {
      return null;
    }

    const first = failed[0]!;

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
            id="component.bank.syncFailed"
            defaultMessage="Bank sync failed for {name}"
            values={{ name: first.name }}
          />
        </span>
        <div style={{ display: 'flex', gap: theme.space.sm, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              void navigate('/bank-connections');
            }}
            style={{
              padding: `${String(theme.space.xs)}px ${String(theme.space.md)}px`,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.color.status.warning}`,
              backgroundColor: 'transparent',
              color: theme.color.status.warning,
              fontSize: theme.fontSize.sm,
              fontWeight: theme.fontWeight.semibold,
              cursor: 'pointer',
            }}
          >
            <FormattedMessage id="component.bank.syncFailed.reconnect" defaultMessage="Reconnect" />
          </button>
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
  },
);
