import React from 'react';
import { Text } from 'react-native';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../theme/index.js';
import { BiometricGate } from '../../../components/BiometricGate.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => true,
  useLoopsEnabled: (): boolean => false,
  useAppActive: (): boolean => true,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: (): Promise<null> => Promise.resolve(null),
}));

jest.mock('../../../../infrastructure/index.js', () => ({
  biometricUnlockService: {
    canUseBiometrics: (): Promise<boolean> => Promise.resolve(true),
    isBiometricEnabled: (): Promise<boolean> => Promise.resolve(false),
    authenticate: (): Promise<boolean> => Promise.resolve(false),
    setBiometricEnabled: (): Promise<void> => Promise.resolve(),
  },
}));

describe('BiometricGate', () => {
  it('hosts the toast, so a failed opt-in is announced and survives the switch to the app', async () => {
    await render(
      <ThemeProvider>
        <IntlProvider locale="en" defaultLocale="en">
          <BiometricGate>
            <Text>app content</Text>
          </BiometricGate>
        </IntlProvider>
      </ThemeProvider>,
    );
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(screen.getByText('app content')).toBeTruthy();
    });
    expect(
      screen.getByText('Authentication failed. Biometric unlock was not enabled.'),
    ).toBeTruthy();
  });
});
