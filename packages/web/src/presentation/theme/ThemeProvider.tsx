import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { darkTheme, lightTheme, type Theme } from '@power-budget/design-tokens';
import { useMediaQuery } from './mediaQuery.js';
import {
  DARK_SCHEME_QUERY,
  applyThemeToDocument,
  readStoredPreference,
  resolveTheme,
  storePreference,
  type ResolvedTheme,
  type ThemePreference,
} from './themePreference.js';

export interface ThemeState {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
  readonly tokens: Theme;
  readonly setPreference: (preference: ThemePreference) => void;
}

const ThemeStateContext = createContext<ThemeState | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Pins the token object (legacy callers and tests); the runtime state still drives `data-theme`. */
  theme?: Theme;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const systemPrefersDark = useMediaQuery(DARK_SCHEME_QUERY);
  const resolved = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    applyThemeToDocument(resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference): void => {
    storePreference(next);
    setPreferenceState(next);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({
      preference,
      resolved,
      tokens: theme ?? (resolved === 'light' ? lightTheme : darkTheme),
      setPreference,
    }),
    [preference, resolved, theme, setPreference],
  );

  return <ThemeStateContext.Provider value={value}>{children}</ThemeStateContext.Provider>;
}

/** Theme preference, the resolved theme and the setter. Must be used under `ThemeProvider`. */
export function useTheme(): ThemeState {
  const state = useContext(ThemeStateContext);
  if (state === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return state;
}

/** Token object of the active theme; falls back to the dark tokens outside a provider. */
export function useThemeTokens(): Theme {
  return useContext(ThemeStateContext)?.tokens ?? darkTheme;
}
