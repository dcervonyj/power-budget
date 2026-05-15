import React from 'react';
import { FormattedMessage } from 'react-intl';

export function AddBankConnectionScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.addBankConnection.title" defaultMessage="Add Bank Connection" />
    </div>
  );
}
