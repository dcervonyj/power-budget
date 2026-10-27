import React from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import type { BankProviderDto } from '@power-budget/shared-app/contract';
import { consentStateOf, type ConsentState } from '../../../application/bank/ConsentRenewal.js';
import type { BankConnection } from '../../../infrastructure/api/BankConnectionMapper.js';
import { Icon } from '../../glass/atoms/Icon.js';
import type { IconName } from '../../glass/atoms/iconPaths.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import { SyncChip } from '../../glass/atoms/SyncChip.js';
import type { SyncChipState } from '../../glass/atoms/syncChipState.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { Button } from '../Button.js';
import { EmptyState } from '../shared/EmptyState.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { SkeletonList } from '../shared/SkeletonList.js';

export interface BankConnectionsListProps {
  readonly connections: readonly BankConnection[];
  readonly loading: boolean;
  /** The list could not be loaded. */
  readonly error: boolean;
  /** Ids with a refresh in flight. */
  readonly refreshingIds: readonly string[];
  readonly now: Date;
  readonly onAddConnection: () => void;
  readonly onReconnect: (id: string) => void;
  readonly onRefresh: (id: string) => void;
  readonly onRetry: () => void;
}

const LIST_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 'var(--pb-glass-space-md)',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const CARD_CONTENT_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
  padding: 'var(--pb-glass-space-xl)',
};

const IDENTITY_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-md)',
};

const NAME_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-heading-web)',
  fontWeight: 600,
  overflowWrap: 'anywhere',
};

const CAPTION_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-small-web)',
  color: 'var(--pb-glass-dim)',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
};

export function BankConnectionsList({
  connections,
  loading,
  error,
  refreshingIds,
  now,
  onAddConnection,
  onReconnect,
  onRefresh,
  onRetry,
}: BankConnectionsListProps): React.JSX.Element {
  const intl = useIntl();

  if (loading && connections.length === 0) {
    return <SkeletonList rows={3} rowHeight={120} />;
  }
  if (error) {
    return (
      <ErrorBanner
        message={
          <FormattedMessage
            id="bank.connections.error"
            defaultMessage="Could not load bank connections"
          />
        }
        onRetry={onRetry}
      />
    );
  }
  if (connections.length === 0) {
    return (
      <EmptyState
        title={
          <FormattedMessage
            id="bank.connections.empty.title"
            defaultMessage="No bank connections yet"
          />
        }
        subtitle={
          <FormattedMessage
            id="bank.connections.empty.description"
            defaultMessage="Connect your bank to sync transactions automatically."
          />
        }
        action={{
          label: (
            <FormattedMessage id="bank.connections.empty.cta" defaultMessage="Connect a bank" />
          ),
          onPress: onAddConnection,
        }}
      />
    );
  }

  return (
    <ul
      style={LIST_STYLE}
      aria-label={intl.formatMessage({
        id: 'bank.connections.list',
        defaultMessage: 'Bank connections',
      })}
    >
      {connections.map((connection, index) => (
        <li key={connection.id}>
          <ConnectionCard
            connection={connection}
            index={index}
            now={now}
            refreshing={refreshingIds.includes(connection.id)}
            onReconnect={onReconnect}
            onRefresh={onRefresh}
          />
        </li>
      ))}
    </ul>
  );
}

interface ConnectionCardProps {
  readonly connection: BankConnection;
  readonly index: number;
  readonly now: Date;
  readonly refreshing: boolean;
  readonly onReconnect: (id: string) => void;
  readonly onRefresh: (id: string) => void;
}

function ConnectionCard({
  connection,
  index,
  now,
  refreshing,
  onReconnect,
  onRefresh,
}: ConnectionCardProps): React.JSX.Element {
  const intl = useIntl();
  const state = consentStateOf(connection, now);
  const chip = chipStateOf(state, refreshing);
  const needsReconnect = state.kind !== 'active' && state.kind !== 'disconnected';

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={index}
      decor={{ specular: true }}
      contentStyle={CARD_CONTENT_STYLE}
    >
      <div style={IDENTITY_STYLE}>
        <span style={{ color: 'var(--pb-glass-dim)', display: 'inline-flex' }}>
          <Icon name="bank" size={28} />
        </span>
        <div>
          <h2 style={NAME_STYLE}>{connection.bankId}</h2>
          <p style={CAPTION_STYLE}>{providerLabel(intl, connection.provider)}</p>
        </div>
      </div>
      <div style={ACTIONS_STYLE}>
        <StatusTag kind={tagKindOf(state)} icon={tagIconOf(state)} label={tagLabel(intl, state)} />
        {chip !== null && <SyncChip state={chip} />}
      </div>
      <p style={CAPTION_STYLE}>
        <ConsentCaption connection={connection} state={state} />
      </p>
      <div style={ACTIONS_STYLE}>
        {needsReconnect && (
          <Button
            variant="primary"
            onClick={() => {
              onReconnect(connection.id);
            }}
          >
            <FormattedMessage id="bank.connection.reconnect" defaultMessage="Reconnect" />
          </Button>
        )}
        {state.kind !== 'disconnected' && (
          <Button
            variant="secondary"
            loading={refreshing}
            onClick={() => {
              onRefresh(connection.id);
            }}
          >
            <FormattedMessage id="bank.connection.refresh" defaultMessage="Refresh now" />
          </Button>
        )}
      </div>
    </GlassPanel>
  );
}

function ConsentCaption({
  connection,
  state,
}: {
  connection: BankConnection;
  state: ConsentState;
}): React.JSX.Element | null {
  const intl = useIntl();
  const expiresAt = connection.expiresAt;
  if (expiresAt === null || state.kind === 'disconnected' || state.kind === 'reconnect') {
    return null;
  }
  const date = intl.formatDate(expiresAt, { dateStyle: 'medium', timeZone: 'UTC' });
  if (state.kind === 'expired') {
    return (
      <FormattedMessage
        id="bank.connection.consent.expired"
        defaultMessage="Access ended on {date}"
        values={{ date }}
      />
    );
  }
  if (state.kind === 'expiring') {
    return (
      <FormattedMessage
        id="bank.connection.consent.expiring"
        defaultMessage="Access ends on {date}, {days, plural, one {# day} other {# days}} left"
        values={{ date, days: state.daysLeft }}
      />
    );
  }

  return (
    <FormattedMessage
      id="bank.connection.consent.until"
      defaultMessage="Access valid until {date}"
      values={{ date }}
    />
  );
}

/** Active connections carry no sync time in the API, so they show a chip only while refreshing. */
function chipStateOf(state: ConsentState, refreshing: boolean): SyncChipState | null {
  if (refreshing) {
    return { kind: 'updating' };
  }
  switch (state.kind) {
    case 'active':
      return null;
    case 'expiring':
    case 'expired':
    case 'reconnect':
      return { kind: 'renew' };
    case 'disconnected':
      return { kind: 'stale' };
  }
}

function tagKindOf(state: ConsentState): 'ok' | 'over' | 'neutral' {
  switch (state.kind) {
    case 'active':
      return 'ok';
    case 'expiring':
    case 'expired':
    case 'reconnect':
      return 'over';
    case 'disconnected':
      return 'neutral';
  }
}

function tagIconOf(state: ConsentState): IconName {
  switch (state.kind) {
    case 'active':
      return 'check';
    case 'expiring':
      return 'clock';
    case 'expired':
      return 'link-off';
    case 'reconnect':
      return 'warning';
    case 'disconnected':
      return 'lock';
  }
}

function tagLabel(intl: IntlShape, state: ConsentState): string {
  switch (state.kind) {
    case 'active':
      return intl.formatMessage({
        id: 'bank.connection.status.active',
        defaultMessage: 'Connected',
      });
    case 'expiring':
      return intl.formatMessage({
        id: 'bank.connection.status.expiring',
        defaultMessage: 'Renewal due',
      });
    case 'expired':
      return intl.formatMessage({
        id: 'bank.connection.status.expired',
        defaultMessage: 'Access ended',
      });
    case 'reconnect':
      return intl.formatMessage({
        id: 'bank.connection.status.reconnect',
        defaultMessage: 'Reconnect needed',
      });
    case 'disconnected':
      return intl.formatMessage({
        id: 'bank.connection.status.disconnected',
        defaultMessage: 'Disconnected',
      });
  }
}

function providerLabel(intl: IntlShape, provider: BankProviderDto): string {
  switch (provider) {
    case 'gocardless':
      return intl.formatMessage({
        id: 'bank.provider.gocardless',
        defaultMessage: 'Open Banking (PSD2)',
      });
    case 'wise_personal':
      return intl.formatMessage({ id: 'bank.provider.wise', defaultMessage: 'Wise' });
  }
}
