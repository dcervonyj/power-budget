import React from 'react';
import { FormattedMessage } from 'react-intl';

export function DashboardScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.dashboard.title" defaultMessage="Dashboard" />
    </div>
  );
}
