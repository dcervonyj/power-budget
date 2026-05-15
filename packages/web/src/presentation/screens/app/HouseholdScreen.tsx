import React from 'react';
import { FormattedMessage } from 'react-intl';

export function HouseholdScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.household.title" defaultMessage="Household" />
    </div>
  );
}
