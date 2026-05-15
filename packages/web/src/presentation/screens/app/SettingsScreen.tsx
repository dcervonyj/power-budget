import React from 'react';
import { FormattedMessage } from 'react-intl';

export function SettingsScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.settings.title" defaultMessage="Settings" />
    </div>
  );
}
