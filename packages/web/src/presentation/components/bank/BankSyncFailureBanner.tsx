import React, { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { BankBanner } from './BankBanner.js';

export interface BankSyncFailureBannerViewProps {
  readonly name: string;
  readonly onReconnect: () => void;
  readonly onDismiss: () => void;
}

export function BankSyncFailureBannerView({
  name,
  onReconnect,
  onDismiss,
}: BankSyncFailureBannerViewProps): React.JSX.Element {
  return (
    <BankBanner
      message={
        <FormattedMessage
          id="bank.syncFailed.message"
          defaultMessage="Bank sync failed for {name}"
          values={{ name }}
        />
      }
      actionLabel={<FormattedMessage id="bank.syncFailed.reconnect" defaultMessage="Reconnect" />}
      onAction={onReconnect}
      onDismiss={onDismiss}
    />
  );
}

/** Store-backed banner for screens outside the bank page: Reconnect opens the connections. */
export const BankSyncFailureBanner = observer(
  function BankSyncFailureBanner(): React.JSX.Element | null {
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(false);
    const failed = bankConnectionStore.connections.find((c) => c.status === 'reconnect_required');

    if (dismissed || failed === undefined) {
      return null;
    }

    return (
      <BankSyncFailureBannerView
        name={failed.bankId}
        onReconnect={() => {
          void navigate(ROUTE_PATHS.bankConnections);
        }}
        onDismiss={() => {
          setDismissed(true);
        }}
      />
    );
  },
);
