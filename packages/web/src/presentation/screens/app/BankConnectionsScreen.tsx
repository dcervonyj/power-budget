import React from 'react';
import { FormattedMessage } from 'react-intl';

export function BankConnectionsScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.bankConnections.title" defaultMessage="Bank Connections" />
    </div>
  );
}
