import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { glassDarkTheme, glassLightTheme, glassThemeToRn } from '@power-budget/design-tokens/glass';
import type { GlassRnTheme } from '@power-budget/design-tokens/glass';
import {
  THEME_PREFERENCE_STORAGE_KEY,
  isThemePreference,
  resolveThemeName,
} from './ThemePreference.js';
import type { ResolvedThemeName, ThemePreference } from './ThemePreference.js';

export interface ThemeContextValue {
  readonly preference: ThemePreference;
  readonly resolvedName: ResolvedThemeName;
  readonly glass: GlassRnTheme;
  /** False until the stored preference has been read from AsyncStorage. */
  readonly isLoaded: boolean;
  readonly setPreference: (preference: ThemePreference) => void;
}

const glassDark = glassThemeToRn(glassDarkTheme);
const glassLight = glassThemeToRn(glassLightTheme);

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemScheme, setSystemScheme] = useState<string | null | undefined>(() =>
    Appearance.getColorScheme(),
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      })
      .catch((error: unknown) => {
        console.warn('Failed to read theme preference', error);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference): void => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next).catch((error: unknown) => {
      console.warn('Failed to store theme preference', error);
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolvedName = resolveThemeName(preference, systemScheme);

    return {
      preference,
      resolvedName,
      glass: resolvedName === 'light' ? glassLight : glassDark,
      isLoaded,
      setPreference,
    };
  }, [preference, systemScheme, isLoaded, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return value;
}

export function useGlass(): GlassRnTheme {
  return useTheme().glass;
}
