import React from 'react';
import { FormattedMessage } from 'react-intl';

export function TransactionDetailScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.transactionDetail.title" defaultMessage="Transaction Detail" />
    </div>
  );
}
