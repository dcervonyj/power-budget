import React from 'react';
import { FormattedMessage } from 'react-intl';
import { LocaleSwitcher } from '../../components/LocaleSwitcher.js';

export function SettingsScreen(): React.JSX.Element {
  return (
    <div>
      <h1>
        <FormattedMessage id="screen.settings.title" defaultMessage="Settings" />
      </h1>
      <section>
        <h2>
          <FormattedMessage
            id="screen.settings.locale.section"
            defaultMessage="Language & Region"
          />
        </h2>
        <LocaleSwitcher />
      </section>
    </div>
  );
}
