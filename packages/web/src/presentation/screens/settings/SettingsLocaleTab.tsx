import React from 'react';
import { FormattedMessage } from 'react-intl';
import { useTheme } from '../../components/ThemeContext.js';
import { LocaleSwitcher } from '../../components/LocaleSwitcher.js';

export function SettingsLocaleTab(): React.JSX.Element {
  const theme = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.lg, maxWidth: 400 }}>
      <p style={{ margin: 0, fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
        <FormattedMessage
          id="settings.locale.description"
          defaultMessage="Choose your preferred language for the interface."
        />
      </p>
      <LocaleSwitcher />
    </div>
  );
}
