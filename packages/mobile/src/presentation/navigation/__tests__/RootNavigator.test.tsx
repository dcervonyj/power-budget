import React from 'react';
import { Text as MockText } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { act, render, screen } from '@testing-library/react-native';
import { RootNavigator } from '../RootNavigator.js';
import { ExpoSecureStoreTokenStore } from '../../../infrastructure/tokens/ExpoSecureStoreTokenStore.js';

const mockStorage = new Map<string, string>();
const mockIsCompleted = jest.fn<Promise<boolean>, []>();

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string): Promise<string | null> =>
    Promise.resolve(mockStorage.get(key) ?? null),
  setItemAsync: (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);

    return Promise.resolve();
  },
  deleteItemAsync: (key: string): Promise<void> => {
    mockStorage.delete(key);

    return Promise.resolve();
  },
}));
jest.mock('../../../infrastructure/index.js', () => {
  const { ExpoSecureStoreTokenStore: Store } = jest.requireActual(
    '../../../infrastructure/tokens/ExpoSecureStoreTokenStore',
  );

  return {
    tokenStore: new Store(),
    onboardingApi: { isCompleted: (): Promise<boolean> => mockIsCompleted(), complete: jest.fn() },
  };
});
jest.mock('../AuthStackNavigator.js', () => ({
  AuthStackNavigator: (): React.JSX.Element => <MockText>auth stack</MockText>,
}));
jest.mock('../../screens/onboarding/OnboardingScreen.js', () => ({
  OnboardingScreen: (): React.JSX.Element => <MockText>onboarding screen</MockText>,
}));
jest.mock('../AppStackNavigator.js', () => ({
  AppStackNavigator: (): React.JSX.Element => <MockText>app stack</MockText>,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tokenStore } = require('../../../infrastructure/index.js') as {
  tokenStore: ExpoSecureStoreTokenStore;
};

async function renderNavigator(): Promise<void> {
  await render(
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>,
  );
}

describe('RootNavigator', () => {
  beforeEach(async () => {
    mockStorage.clear();
    mockIsCompleted.mockReset();
    mockIsCompleted.mockResolvedValue(true);
    await tokenStore.clearTokens();
  });

  it('shows the auth stack without a session', async () => {
    await renderNavigator();

    expect(screen.getByText('auth stack')).toBeTruthy();
    expect(screen.queryByText('app stack')).toBeNull();
  });

  it('shows the app stack for a session restored from SecureStore', async () => {
    mockStorage.set('pb_access_token', 'a');
    mockStorage.set('pb_refresh_token', 'r');
    await tokenStore.load();
    await renderNavigator();

    expect(await screen.findByText('app stack')).toBeTruthy();
  });

  it('sends a user who has not completed onboarding to onboarding, not the app', async () => {
    mockIsCompleted.mockResolvedValue(false);
    mockStorage.set('pb_access_token', 'a');
    mockStorage.set('pb_refresh_token', 'r');
    await tokenStore.load();
    await renderNavigator();

    expect(await screen.findByText('onboarding screen')).toBeTruthy();
    expect(screen.queryByText('app stack')).toBeNull();
  });

  it('switches to the app stack on login and back to auth on logout or refresh failure', async () => {
    await renderNavigator();

    await act(async () => {
      await tokenStore.setTokens('a', 'r');
    });
    expect(await screen.findByText('app stack')).toBeTruthy();

    await act(async () => {
      await tokenStore.clearTokens();
    });
    expect(screen.getByText('auth stack')).toBeTruthy();
  });
});
