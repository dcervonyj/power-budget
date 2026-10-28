import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../theme/index.js';
import { LocaleProvider } from '../LocaleProvider.js';
import { SettingsScreen } from '../screens/app/SettingsScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => true,
  useLoopsEnabled: (): boolean => false,
  useAppActive: (): boolean => true,
}));

jest.mock('../../infrastructure/locale/index.js', () => ({
  ...jest.requireActual('../../infrastructure/locale/index.js'),
  loadMessages: (locale: string): Promise<Record<string, string>> =>
    Promise.resolve({ 'settings.signOut': locale === 'pl' ? 'Wyloguj się' : 'Sign out' }),
}));

const PROFILE = {
  id: 'u1',
  email: 'anna@example.com',
  displayName: 'Anna',
  locale: 'en',
  localePreference: 'en',
  defaultLocale: 'en',
  baseCurrency: 'PLN',
  timezone: 'Europe/Warsaw',
  householdId: null,
};

jest.mock('../../infrastructure/index.js', () => ({
  apiClient: {
    get: (): Promise<unknown> => Promise.resolve({ data: PROFILE }),
    patch: (_url: string, body: object): Promise<unknown> =>
      Promise.resolve({ data: { ...PROFILE, ...body } }),
    invalidateSession: (): Promise<void> => Promise.resolve(),
  },
  biometricUnlockService: {
    canUseBiometrics: (): Promise<boolean> => Promise.resolve(false),
    isBiometricEnabled: (): Promise<boolean> => Promise.resolve(false),
  },
}));

describe('Settings language switch', () => {
  it('shows the new language without remounting the screen', async () => {
    await render(
      <ThemeProvider>
        <LocaleProvider deviceLanguage="en">
          <SettingsScreen />
        </LocaleProvider>
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText('Sign out')).toBeOnTheScreen();
    });
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Polski' })).toBeOnTheScreen();
    });

    await act(async () => {
      await fireEvent.press(screen.getByRole('radio', { name: 'Polski' }));
    });

    await waitFor(() => {
      expect(screen.getByText('Wyloguj się')).toBeOnTheScreen();
    });
    expect(screen.queryByText('Sign out')).toBeNull();
  });
});
