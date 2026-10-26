import React from 'react';
import { Appearance, Text } from 'react-native';
import type { ColorSchemeName } from 'react-native';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useGlass, useTheme } from '../ThemeProvider.js';
import { THEME_PREFERENCE_STORAGE_KEY } from '../ThemePreference.js';
import { makeStyles } from '../makeStyles.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const useStyles = makeStyles((glass) => ({ box: { backgroundColor: glass.colors.base } }));

let setPreferenceRef: ((p: 'system' | 'dark' | 'light') => void) | null = null;
let listener: ((p: { colorScheme: ColorSchemeName }) => void) | null = null;

function Probe(): React.JSX.Element {
  const { preference, resolvedName, isLoaded, setPreference } = useTheme();
  const glass = useGlass();
  const styles = useStyles();
  setPreferenceRef = setPreference;

  return (
    <Text testID="probe" style={styles.box}>
      {`${preference}|${resolvedName}|${glass.colors.base}|${String(isLoaded)}`}
    </Text>
  );
}

async function renderProbe(): Promise<void> {
  await render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setPreferenceRef = null;
    listener = null;
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue('light');
    jest.spyOn(Appearance, 'addChangeListener').mockImplementation((cb) => {
      listener = cb;

      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('follows the system scheme by default and reacts to changes', async () => {
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toMatch(/true$/));
    expect(screen.getByTestId('probe').props.children).toMatch(/^system\|light\|/);

    await act(async () => {
      listener?.({ colorScheme: 'dark' });
    });

    expect(screen.getByTestId('probe').props.children).toMatch(/^system\|dark\|/);
  });

  it('falls back to dark when the system has no scheme', async () => {
    jest.spyOn(Appearance, 'getColorScheme').mockReturnValue(null);
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toMatch(/true$/));

    expect(screen.getByTestId('probe').props.children).toMatch(/^system\|dark\|/);
  });

  it('persists the chosen preference and ignores the system scheme afterwards', async () => {
    await renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toMatch(/true$/));

    await act(async () => {
      setPreferenceRef?.('dark');
    });

    expect(screen.getByTestId('probe').props.children).toMatch(/^dark\|dark\|/);
    expect(await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');
  });

  it('restores a stored preference on mount', async () => {
    await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
    await renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId('probe').props.children).toMatch(/^dark\|dark\|.*\|true$/),
    );
  });

  it('ignores an invalid stored value', async () => {
    await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'sepia');
    await renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe').props.children).toMatch(/true$/));
    expect(screen.getByTestId('probe').props.children).toMatch(/^system\|light\|/);
  });
});
