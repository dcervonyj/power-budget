import React from 'react';
import { FormattedMessage } from 'react-intl';
import { LocaleSwitcher } from '../../components/LocaleSwitcher.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { FIELDS_STYLE, NOTE_STYLE, SECTION_STYLE } from './settingsStyles.js';

export function SettingsLocaleTab(): React.JSX.Element {
  return (
    <GlassPanel material="frosted" depth={1} contentStyle={SECTION_STYLE}>
      <p style={NOTE_STYLE}>
        <FormattedMessage
          id="settings.locale.description"
          defaultMessage="Choose your preferred language for the interface."
        />
      </p>
      <div style={FIELDS_STYLE}>
        <LocaleSwitcher />
      </div>
    </GlassPanel>
  );
}
