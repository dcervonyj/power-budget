import React from 'react';
import { Text as MockText } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { App } from '../App.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockFontsLoaded = false;

jest.mock('expo-font', () => ({
  useFonts: (): [boolean, Error | null] => [mockFontsLoaded, null],
}));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: (): boolean => false }));
jest.mock('../theme/fonts.js', () => ({ GEIST_FONTS: {} }));
jest.mock('expo-localization', () => ({ getLocales: (): unknown[] => [{ languageCode: 'en' }] }));
jest.mock('expo-status-bar', () => ({ StatusBar: (): null => null }));
jest.mock('../components/BiometricGate.js', () => ({
  BiometricGate: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
}));
jest.mock('../navigation/RootNavigator.js', () => ({
  RootNavigator: (): React.JSX.Element => <MockText>root navigator</MockText>,
}));
jest.mock('../../infrastructure/locale/index.js', () => ({
  LOCALE_STORAGE_KEY: 'locale',
  LocaleResolver: class {
    resolve(): string {
      return 'en';
    }
  },
  loadMessages: (): Promise<Record<string, string>> => Promise.resolve({}),
}));

describe('App', () => {
  it('shows the themed loading view until Geist is loaded', async () => {
    mockFontsLoaded = false;
    await render(<App />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('font-gate-loading')).toBeTruthy();
    expect(screen.queryByText('root navigator')).toBeNull();
  });

  it('renders the navigator behind the font gate once fonts are loaded', async () => {
    mockFontsLoaded = true;
    await render(<App />);

    await waitFor(() => expect(screen.getByText('root navigator')).toBeTruthy());
  });
});
