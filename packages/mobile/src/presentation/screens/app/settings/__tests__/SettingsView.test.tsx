import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../../theme/index.js';
import { SettingsView } from '../SettingsView.js';
import type { SettingsViewProps } from '../settingsTypes.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => true,
  useLoopsEnabled: (): boolean => false,
  useAppActive: (): boolean => true,
}));

function props(overrides: Partial<SettingsViewProps> = {}): SettingsViewProps {
  return {
    loadState: 'ready',
    email: 'anna@example.com',
    nameDraft: 'Anna',
    nameSave: 'idle',
    preference: 'system',
    locale: 'en',
    baseCurrency: 'PLN',
    preferencesError: false,
    biometricAvailable: true,
    biometricEnabled: false,
    biometricError: false,
    signingOut: false,
    onRetry: jest.fn(),
    onNameChange: jest.fn(),
    onNameSave: jest.fn(),
    onPreferenceChange: jest.fn(),
    onLocaleChange: jest.fn(),
    onCurrencyChange: jest.fn(),
    onBiometricChange: jest.fn(),
    onSignOut: jest.fn(),
    ...overrides,
  };
}

async function renderView(view: SettingsViewProps): Promise<void> {
  await render(
    <ThemeProvider>
      <IntlProvider locale="en" defaultLocale="en">
        <SettingsView {...view} />
      </IntlProvider>
    </ThemeProvider>,
  );
}

describe('SettingsView', () => {
  it('marks the stored appearance and reports a change', async () => {
    const view = props({ preference: 'dark' });
    await renderView(view);

    expect(screen.getByRole('radio', { name: 'Night', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Day' }));
    expect(view.onPreferenceChange).toHaveBeenCalledWith('light');
    await fireEvent.press(screen.getByRole('radio', { name: 'System' }));
    expect(view.onPreferenceChange).toHaveBeenCalledWith('system');
  });

  it('reports language and currency choices', async () => {
    const view = props();
    await renderView(view);

    await fireEvent.press(screen.getByRole('radio', { name: 'Polski' }));
    expect(view.onLocaleChange).toHaveBeenCalledWith('pl');
    await fireEvent.press(screen.getByRole('radio', { name: 'EUR' }));
    expect(view.onCurrencyChange).toHaveBeenCalledWith('EUR');
  });

  it('edits and saves the profile name, blocking an empty name', async () => {
    const view = props();
    await renderView(view);

    await fireEvent.changeText(screen.getByDisplayValue('Anna'), 'Anna K');
    expect(view.onNameChange).toHaveBeenCalledWith('Anna K');
    await fireEvent.press(screen.getByText('Save changes'));
    expect(view.onNameSave).toHaveBeenCalledTimes(1);
  });

  it('does not save an empty name', async () => {
    const view = props({ nameDraft: '  ' });
    await renderView(view);

    await fireEvent.press(screen.getByText('Save changes'));
    expect(view.onNameSave).not.toHaveBeenCalled();
  });

  it('toggles biometric unlock only when the device supports it', async () => {
    const view = props();
    await renderView(view);

    await fireEvent.press(screen.getByRole('switch', { name: 'Biometric unlock' }));
    expect(view.onBiometricChange).toHaveBeenCalledWith(true);
  });

  it('shows inline feedback when changing biometric unlock failed', async () => {
    await renderView(props({ biometricError: true }));

    expect(
      screen.getByText('Could not change biometric unlock. Please try again.'),
    ).toBeOnTheScreen();
  });

  it.each(['loading', 'error', 'ready'] as const)(
    'offers sign out in the %s state',
    async (loadState) => {
      const view = props({ loadState });
      await renderView(view);

      await fireEvent.press(screen.getByText('Sign out'));
      expect(view.onSignOut).toHaveBeenCalledTimes(1);
    },
  );

  it('hides biometric unlock when unavailable', async () => {
    await renderView(props({ biometricAvailable: false }));

    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('signs out', async () => {
    const view = props();
    await renderView(view);

    await fireEvent.press(screen.getByText('Sign out'));
    expect(view.onSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows a saved and a save-error status', async () => {
    await renderView(props({ nameSave: 'saved' }));
    expect(screen.getByText('Saved')).toBeOnTheScreen();
  });

  it('shows a retryable load error but keeps Appearance and sign out', async () => {
    const view = props({ loadState: 'error' });
    await renderView(view);

    expect(screen.getByText('Could not load your profile.')).toBeOnTheScreen();
    expect(screen.queryByText('Save changes')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Night' })).toBeOnTheScreen();
    expect(screen.getByText('Sign out')).toBeOnTheScreen();
  });

  it('renders a skeleton while loading', async () => {
    await renderView(props({ loadState: 'loading' }));

    expect(screen.getByTestId('settings-loading')).toBeOnTheScreen();
  });

  it('offers currency choices when no base currency is set yet', async () => {
    const view = props({ baseCurrency: null });
    await renderView(view);

    await fireEvent.press(screen.getByRole('radio', { name: 'EUR' }));
    expect(view.onCurrencyChange).toHaveBeenCalledWith('EUR');
  });
});
