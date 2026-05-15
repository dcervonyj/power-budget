import React from 'react';
import { FormattedMessage } from 'react-intl';

export function CategoriesScreen(): React.JSX.Element {
  return (
    <div>
      <FormattedMessage id="screen.categories.title" defaultMessage="Categories" />
    </div>
  );
}
