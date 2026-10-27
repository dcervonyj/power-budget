import React, { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import type { BankActionError } from '../../../application/bank/BankConnectionStore.js';
import type { BankConnection } from '../../../infrastructure/api/BankConnectionMapper.js';
import { Button } from '../Button.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { BankConnectionsList } from './BankConnectionsList.js';
import { BankSyncFailureBannerView } from './BankSyncFailureBanner.js';
import { ReconnectBannerView } from './ReconnectBanner.js';
import { connectionsToRenew, consentStateOf } from '../../../application/bank/ConsentRenewal.js';

export interface BankConnectionsViewProps {
  readonly connections: readonly BankConnection[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly actionError: BankActionError | null;
  readonly refreshingIds: readonly string[];
  readonly now: Date;
  readonly onAddConnection: () => void;
  readonly onReconnect: (id: string) => void;
  readonly onRefresh: (id: string) => void;
  readonly onRetry: () => void;
}

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  maxWidth: 1280,
  margin: '0 auto',
  padding: 'var(--pb-glass-space-lg)',
  boxSizing: 'border-box',
  color: 'var(--pb-glass-fg)',
};

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-md)',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-title-web)',
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

/** Bank connections page: banners for what needs attention, then a card per connection. */
export function BankConnectionsView(props: BankConnectionsViewProps): React.JSX.Element {
  const { connections, now, actionError, onAddConnection, onReconnect } = props;
  const [failureDismissed, setFailureDismissed] = useState(false);
  const [renewDismissed, setRenewDismissed] = useState(false);
  const failed = connections.find((c) => c.status === 'reconnect_required');
  const renew = connectionsToRenew(connections, now)[0];

  return (
    <div style={PAGE_STYLE}>
      <header style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>
          <FormattedMessage id="bank.connections.title" defaultMessage="Bank connections" />
        </h1>
        <Button variant="primary" onClick={onAddConnection}>
          <FormattedMessage id="bank.connections.add" defaultMessage="Add connection" />
        </Button>
      </header>

      {actionError !== null && <ErrorBanner message={<ActionErrorText action={actionError} />} />}
      {failed !== undefined && !failureDismissed && (
        <BankSyncFailureBannerView
          name={failed.bankId}
          onReconnect={() => {
            onReconnect(failed.id);
          }}
          onDismiss={() => {
            setFailureDismissed(true);
          }}
        />
      )}
      {renew !== undefined && !renewDismissed && (
        <ReconnectBannerView
          name={renew.bankId}
          state={consentStateOf(renew, now)}
          onReconnect={() => {
            onReconnect(renew.id);
          }}
          onDismiss={() => {
            setRenewDismissed(true);
          }}
        />
      )}

      <BankConnectionsList {...props} />
    </div>
  );
}

function ActionErrorText({ action }: { action: BankActionError }): React.JSX.Element {
  switch (action) {
    case 'reconnect':
      return (
        <FormattedMessage
          id="bank.error.reconnect"
          defaultMessage="Could not start the reconnect"
        />
      );
    case 'refresh':
      return (
        <FormattedMessage
          id="bank.error.refresh"
          defaultMessage="Could not refresh the connection"
        />
      );
    case 'connect':
      return (
        <FormattedMessage
          id="bank.error.connect"
          defaultMessage="Failed to connect. Please try again."
        />
      );
  }
}
