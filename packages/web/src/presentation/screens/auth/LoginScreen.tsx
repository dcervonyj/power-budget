import React from 'react';
import { FormattedMessage } from 'react-intl';

export function LoginScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.login.title" defaultMessage="Login" />
    </div>
  );
}
