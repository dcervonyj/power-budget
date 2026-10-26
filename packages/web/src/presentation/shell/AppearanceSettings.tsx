import React from 'react';
import { useTheme } from '../theme/ThemeProvider.js';
import { ThemeChoice } from './ThemeChoice.js';

/**
 * `/settings/appearance`: the same System / Night / Day choice as the account menu. Registered
 * now so the settings ticket (DSN-028) only adds the tab, not a route.
 */
export function AppearanceSettings(): React.JSX.Element {
  const { preference, setPreference } = useTheme();

  return (
    <div style={{ maxWidth: 420 }}>
      <ThemeChoice value={preference} onChange={setPreference} />
    </div>
  );
}
