import React from 'react';
import { FormattedMessage } from 'react-intl';

export function PlansListScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.plansList.title" defaultMessage="Plans" />
    </div>
  );
}
