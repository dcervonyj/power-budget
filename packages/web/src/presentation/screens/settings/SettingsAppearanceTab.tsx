import React from 'react';
import { FormattedMessage } from 'react-intl';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import type { ThemePreference } from '../../theme/themePreference.js';
import { ThemeChoice } from '../../shell/ThemeChoice.js';
import { useTheme } from '../../theme/ThemeProvider.js';
import { FIELDS_STYLE, HEADING_STYLE, NOTE_STYLE, SECTION_STYLE } from './settingsStyles.js';

/** Settings > Appearance: System / Night / Day, stored on this device by the theme runtime. */
export function SettingsAppearanceTab(): React.JSX.Element {
  const { preference, setPreference } = useTheme();

  return <AppearanceView preference={preference} onChange={setPreference} />;
}

export interface AppearanceViewProps {
  readonly preference: ThemePreference;
  readonly onChange: (preference: ThemePreference) => void;
}

export function AppearanceView({ preference, onChange }: AppearanceViewProps): React.JSX.Element {
  return (
    <GlassPanel material="frosted" depth={1} contentStyle={SECTION_STYLE}>
      <h2 style={HEADING_STYLE}>
        <FormattedMessage id="settings.appearance.title" defaultMessage="Appearance" />
      </h2>
      <p style={NOTE_STYLE}>
        <FormattedMessage
          id="settings.appearance.description"
          defaultMessage="Choose Night, Day, or follow your device. The choice is kept on this device."
        />
      </p>
      <div style={FIELDS_STYLE}>
        <ThemeChoice value={preference} onChange={onChange} />
      </div>
    </GlassPanel>
  );
}
