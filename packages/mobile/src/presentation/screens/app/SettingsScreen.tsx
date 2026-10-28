import React from 'react';
import { SettingsView } from './settings/SettingsView.js';
import { useSettings } from './settings/useSettings.js';

/** Settings tab: the data container around SettingsView. */
export function SettingsScreen(): React.JSX.Element {
  return <SettingsView {...useSettings()} />;
}
