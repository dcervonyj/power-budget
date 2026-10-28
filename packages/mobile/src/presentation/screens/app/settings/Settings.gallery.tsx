import React from 'react';
import { ShellBackground } from '../../../navigation/ShellBackground.js';
import { SettingsView } from './SettingsView.js';
import type { SettingsViewProps } from './settingsTypes.js';

const READY: SettingsViewProps = {
  loadState: 'ready',
  profile: { email: 'anna@example.com', locale: 'pl' },
  nameDraft: 'Anna Kowalska',
  nameSave: 'idle',
  preference: 'system',
  baseCurrency: 'PLN',
  preferencesError: false,
  biometricAvailable: true,
  biometricEnabled: true,
  biometricError: false,
  signingOut: false,
  onRetry: noop,
  onNameChange: noop,
  onNameSave: noop,
  onPreferenceChange: noop,
  onLocaleChange: noop,
  onCurrencyChange: noop,
  onBiometricChange: noop,
  onSignOut: noop,
};

function Stage({ props }: { readonly props: SettingsViewProps }): React.JSX.Element {
  return (
    <ShellBackground>
      <SettingsView {...props} />
    </ShellBackground>
  );
}

/** Profile, Appearance (System), language, currency, biometric on, sign out. */
export function SettingsReady(): React.JSX.Element {
  return <Stage props={READY} />;
}

/** Appearance set to Night, saved confirmation, biometric unavailable. */
export function SettingsNightSaved(): React.JSX.Element {
  return (
    <Stage
      props={{
        ...READY,
        preference: 'dark',
        nameSave: 'saved',
        biometricAvailable: false,
      }}
    />
  );
}

/** Profile failed to load: the device-local Appearance and sign out still work. */
export function SettingsLoadError(): React.JSX.Element {
  return <Stage props={{ ...READY, loadState: 'error', profile: null, preference: 'light' }} />;
}

function noop(): void {
  // Fixture: no input.
}
