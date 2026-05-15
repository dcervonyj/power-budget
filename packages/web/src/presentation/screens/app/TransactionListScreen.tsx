import React from 'react';
import { FormattedMessage } from 'react-intl';

export function TransactionListScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.transactionList.title" defaultMessage="Transactions" />
    </div>
  );
}
