import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontGate } from '../FontGate.js';
import { ThemeProvider } from '../ThemeProvider.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../fonts.js', () => ({ GEIST_FONTS: {} }));

let mockFontsLoaded = false;

jest.mock('expo-font', () => ({
  useFonts: (): [boolean, Error | null] => [mockFontsLoaded, null],
}));

async function renderGate(): Promise<void> {
  await render(
    <ThemeProvider>
      <FontGate>
        <Text>app content</Text>
      </FontGate>
    </ThemeProvider>,
  );
}

describe('FontGate', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows the themed loading view while fonts load', async () => {
    mockFontsLoaded = false;
    await renderGate();

    expect(screen.getByTestId('font-gate-loading')).toBeTruthy();
    expect(screen.queryByText('app content')).toBeNull();
  });

  it('renders the app once fonts and the stored theme are ready', async () => {
    mockFontsLoaded = true;
    await renderGate();

    await waitFor(() => expect(screen.getByText('app content')).toBeTruthy());
    expect(screen.queryByTestId('font-gate-loading')).toBeNull();
  });
});
