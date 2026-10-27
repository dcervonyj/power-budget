import React, { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import {
  connectionsToRenew,
  consentStateOf,
  type ConsentState,
} from '../../../application/bank/ConsentRenewal.js';
import type { BankConnection } from '../../../infrastructure/api/BankConnectionMapper.js';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { BankBanner } from './BankBanner.js';

export interface ReconnectBannerViewProps {
  readonly name: string;
  readonly state: ConsentState;
  readonly onReconnect: () => void;
  readonly onDismiss: () => void;
}

export interface ReconnectBannerProps {
  readonly connections: readonly BankConnection[];
  /** The clock; tests and the gallery pin it. */
  readonly now?: Date;
}

export function ReconnectBannerView({
  name,
  state,
  onReconnect,
  onDismiss,
}: ReconnectBannerViewProps): React.JSX.Element {
  return (
    <BankBanner
      message={<ReconnectMessage name={name} state={state} />}
      actionLabel={
        <FormattedMessage id="bank.reconnectBanner.action" defaultMessage="Renew access" />
      }
      onAction={onReconnect}
      onDismiss={onDismiss}
    />
  );
}

/** Store-free banner: the first connection whose consent runs out within a week or has. */
export const ReconnectBanner = observer(function ReconnectBanner({
  connections,
  now = new Date(),
}: ReconnectBannerProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const first = connectionsToRenew(connections, now)[0];

  if (dismissed || first === undefined) {
    return null;
  }

  return (
    <ReconnectBannerView
      name={first.bankId}
      state={consentStateOf(first, now)}
      onReconnect={() => {
        void navigate(ROUTE_PATHS.bankConnections);
      }}
      onDismiss={() => {
        setDismissed(true);
      }}
    />
  );
});

function ReconnectMessage({
  name,
  state,
}: {
  name: string;
  state: ConsentState;
}): React.JSX.Element {
  if (state.kind === 'expiring') {
    return (
      <FormattedMessage
        id="bank.reconnectBanner.expiring"
        defaultMessage="Bank access for {name} ends in {days, plural, one {# day} other {# days}}"
        values={{ name, days: state.daysLeft }}
      />
    );
  }

  return (
    <FormattedMessage
      id="bank.reconnectBanner.expired"
      defaultMessage="Bank access for {name} has ended"
      values={{ name }}
    />
  );
}
