import React from 'react';
import { FormattedMessage } from 'react-intl';

export function RegisterScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.register.title" defaultMessage="Register" />
    </div>
  );
}
