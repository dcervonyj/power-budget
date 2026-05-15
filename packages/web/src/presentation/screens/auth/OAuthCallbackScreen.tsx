import React from 'react';
import { FormattedMessage } from 'react-intl';

export function OAuthCallbackScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.oauthCallback.title" defaultMessage="OAuth Callback" />
    </div>
  );
}
