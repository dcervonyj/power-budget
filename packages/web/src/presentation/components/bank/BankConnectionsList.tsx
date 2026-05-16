import React from 'react';
import { observer } from 'mobx-react-lite';
import { FormattedMessage } from 'react-intl';
import { useTheme } from '../ThemeContext.js';
import { Button } from '../Button.js';
import { SyncStatusChip } from './SyncStatusChip.js';
import type { BankConnection, ConnectionStatus } from '../../../domain/bank/BankConnection.js';
import type { BankConnectionStore } from '../../../application/bank/BankConnectionStore.js';

export interface BankConnectionsListProps {
  store: BankConnectionStore;
  onAddConnection: () => void;
}

function statusColors(
  status: ConnectionStatus,
  theme: ReturnType<typeof useTheme>,
): { bg: string; color: string } {
  switch (status) {
    case 'active':
      return { bg: theme.color.status.success + '33', color: theme.color.status.success };
    case 'expired':
      return { bg: theme.color.status.danger + '33', color: theme.color.status.danger };
    case 'error':
      return { bg: theme.color.status.warning + '33', color: theme.color.status.warning };
    case 'pending':
      return { bg: theme.color.text.secondary + '22', color: theme.color.text.secondary };
  }
}

function statusMessageId(status: ConnectionStatus): string {
  switch (status) {
    case 'active':
      return 'bankConnections.status.active';
    case 'expired':
      return 'bankConnections.status.expired';
    case 'error':
      return 'bankConnections.status.error';
    case 'pending':
      return 'bankConnections.status.pending';
  }
}

function SkeletonCard(): React.JSX.Element {
  const theme = useTheme();
  return (
    <div
      style={{
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        padding: theme.space.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.sm,
      }}
    >
      {[80, 120, 60].map((width) => (
        <div
          key={width}
          style={{
            width,
            height: 14,
            borderRadius: theme.radius.sm,
            backgroundColor: theme.color.border.subtle,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

interface ConnectionCardProps {
  connection: BankConnection;
  store: BankConnectionStore;
}

const ConnectionCard = observer(function ConnectionCard({
  connection,
  store,
}: ConnectionCardProps): React.JSX.Element {
  const theme = useTheme();
  const { bg, color } = statusColors(connection.status, theme);
  const needsReconnect = connection.status === 'expired' || connection.status === 'error';

  return (
    <div
      style={{
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        padding: theme.space.lg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.md,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
        <span
          style={{
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
          }}
        >
          {connection.name}
        </span>
        <SyncStatusChip lastSuccessfulAt={connection.lastSuccessfulAt} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm }}>
        {/* Status chip */}
        <span
          style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.medium,
            padding: `${String(theme.space.xs)}px ${String(theme.space.sm)}px`,
            borderRadius: theme.radius.full ?? theme.radius.lg,
            backgroundColor: bg,
            color,
          }}
        >
          <FormattedMessage id={statusMessageId(connection.status)} />
        </span>

        {needsReconnect && (
          <Button
            variant="secondary"
            onClick={() => {
              void store.reconnect(connection.id);
            }}
          >
            <FormattedMessage id="bankConnections.reconnect" />
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={() => {
            void store.refresh(connection.id);
          }}
        >
          <FormattedMessage id="bankConnections.refresh" />
        </Button>
      </div>
    </div>
  );
});

export const BankConnectionsList = observer(function BankConnectionsList({
  store,
  onAddConnection,
}: BankConnectionsListProps): React.JSX.Element {
  const theme = useTheme();

  if (store.loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (store.error !== null) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.space.md,
          padding: theme.space['2xl'],
          color: theme.color.status.danger,
        }}
      >
        <p>{store.error}</p>
        <Button
          variant="secondary"
          onClick={() => {
            void store.fetchConnections();
          }}
        >
          <FormattedMessage id="common.retry" defaultMessage="Retry" />
        </Button>
      </div>
    );
  }

  if (store.connections.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.space.md,
          padding: theme.space['2xl'],
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: theme.fontSize.xl,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.primary,
            margin: 0,
          }}
        >
          <FormattedMessage id="bankConnections.empty.title" />
        </p>
        <p style={{ color: theme.color.text.secondary, margin: 0 }}>
          <FormattedMessage id="bankConnections.empty.description" />
        </p>
        <Button variant="primary" onClick={onAddConnection}>
          <FormattedMessage id="bankConnections.add" />
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
      {store.connections.map((conn) => (
        <ConnectionCard key={conn.id} connection={conn} store={store} />
      ))}
    </div>
  );
});
