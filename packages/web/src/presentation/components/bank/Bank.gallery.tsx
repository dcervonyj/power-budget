import React from 'react';
import type { BankConnection } from '../../../infrastructure/api/BankConnectionMapper.js';
import { BANKS } from '../../../application/bank/addBankFlow.js';
import { AmbientField } from '../../glass/material/AmbientField.js';
import { AddBankConnectionView, type AddBankConnectionViewProps } from './AddBankConnectionView.js';
import { BankConnectionsView, type BankConnectionsViewProps } from './BankConnectionsView.js';
import { BankSyncFailureBannerView } from './BankSyncFailureBanner.js';
import { ReconnectBannerView } from './ReconnectBanner.js';

/** The clock of the D7 sample data: 27 October 2026. */
const NOW = new Date('2026-10-27T12:00:00.000Z');

const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  margin: 'calc(-1 * var(--pb-glass-space-3xl))',
  minHeight: 600,
  overflow: 'hidden',
  color: 'var(--pb-glass-fg)',
};

const LAYER: React.CSSProperties = { position: 'relative', zIndex: 1 };

function connection(overrides: Partial<BankConnection>): BankConnection {
  return {
    id: 'conn-pko',
    bankId: 'PKO_BPKOPLPW',
    provider: 'gocardless',
    status: 'active',
    expiresAt: new Date('2027-01-20T00:00:00.000Z'),
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    ...overrides,
  };
}

const ACTIVE = connection({});
const EXPIRING = connection({
  id: 'conn-mbank',
  bankId: 'MBANK_BREXPLPW',
  expiresAt: new Date('2026-10-30T00:00:00.000Z'),
});
const EXPIRED = connection({
  id: 'conn-ing',
  bankId: 'ING_INGBPLPW',
  status: 'expired',
  expiresAt: new Date('2026-10-20T00:00:00.000Z'),
});
const RECONNECT = connection({
  id: 'conn-santander',
  bankId: 'SANTANDER_WBKPPLPP',
  status: 'reconnect_required',
});
const DISCONNECTED = connection({
  id: 'conn-wise',
  bankId: 'WISE',
  provider: 'wise_personal',
  status: 'disconnected',
  expiresAt: null,
});

function noop(): void {
  // Gallery fixtures do not react to input.
}

function listProps(overrides: Partial<BankConnectionsViewProps> = {}): BankConnectionsViewProps {
  return {
    connections: [ACTIVE, EXPIRING, EXPIRED, RECONNECT, DISCONNECTED],
    loading: false,
    error: false,
    actionError: null,
    refreshingIds: [],
    now: NOW,
    onAddConnection: noop,
    onReconnect: noop,
    onRefresh: noop,
    onRetry: noop,
    ...overrides,
  };
}

function addProps(overrides: Partial<AddBankConnectionViewProps>): AddBankConnectionViewProps {
  return {
    step: 'provider',
    provider: 'gocardless',
    banks: BANKS.filter((bank) => bank.provider === 'gocardless'),
    bankSearch: '',
    selectedBank: BANKS[0] ?? null,
    submitting: false,
    failed: false,
    onProvider: noop,
    onSearch: noop,
    onBank: noop,
    onBack: noop,
    onNext: noop,
    onConnect: noop,
    ...overrides,
  };
}

function Stage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={STAGE}>
      <AmbientField />
      <div style={LAYER}>{children}</div>
    </div>
  );
}

/** Every connection state: connected, renewal due, access ended, reconnect needed, disconnected. */
export function BankConnectionStates(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps()} />
    </Stage>
  );
}

/** A healthy connection only: no banners, no chip. */
export function BankConnectionsHealthy(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps({ connections: [ACTIVE] })} />
    </Stage>
  );
}

/** A refresh in flight shows the updating chip. */
export function BankConnectionRefreshing(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps({ connections: [ACTIVE], refreshingIds: [ACTIVE.id] })} />
    </Stage>
  );
}

/** No connections: the empty state offers the connect action. */
export function BankConnectionsEmpty(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps({ connections: [] })} />
    </Stage>
  );
}

export function BankConnectionsLoading(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps({ connections: [], loading: true })} />
    </Stage>
  );
}

export function BankConnectionsError(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps({ connections: [], error: true })} />
    </Stage>
  );
}

/** A failed reconnect keeps the cards and says so above them. */
export function BankConnectionsActionError(): React.JSX.Element {
  return (
    <Stage>
      <BankConnectionsView {...listProps({ connections: [ACTIVE], actionError: 'reconnect' })} />
    </Stage>
  );
}

/** The two banners as they show on other screens. */
export function BankBanners(): React.JSX.Element {
  return (
    <Stage>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--pb-glass-space-md)',
          padding: 'var(--pb-glass-space-lg)',
        }}
      >
        <BankSyncFailureBannerView name="SANTANDER_WBKPPLPP" onReconnect={noop} onDismiss={noop} />
        <ReconnectBannerView
          name="MBANK_BREXPLPW"
          state={{ kind: 'expiring', daysLeft: 3 }}
          onReconnect={noop}
          onDismiss={noop}
        />
        <ReconnectBannerView
          name="ING_INGBPLPW"
          state={{ kind: 'expired' }}
          onReconnect={noop}
          onDismiss={noop}
        />
      </div>
    </Stage>
  );
}

export function AddBankProvider(): React.JSX.Element {
  return (
    <Stage>
      <AddBankConnectionView {...addProps({ step: 'provider', provider: null })} />
    </Stage>
  );
}

export function AddBankPickBank(): React.JSX.Element {
  return (
    <Stage>
      <AddBankConnectionView {...addProps({ step: 'bank' })} />
    </Stage>
  );
}

export function AddBankPickBankNoMatch(): React.JSX.Element {
  return (
    <Stage>
      <AddBankConnectionView {...addProps({ step: 'bank', banks: [], bankSearch: 'zzz' })} />
    </Stage>
  );
}

export function AddBankScope(): React.JSX.Element {
  return (
    <Stage>
      <AddBankConnectionView {...addProps({ step: 'scope' })} />
    </Stage>
  );
}

export function AddBankConnect(): React.JSX.Element {
  return (
    <Stage>
      <AddBankConnectionView {...addProps({ step: 'connect' })} />
    </Stage>
  );
}

export function AddBankConnectFailed(): React.JSX.Element {
  return (
    <Stage>
      <AddBankConnectionView {...addProps({ step: 'connect', failed: true })} />
    </Stage>
  );
}
