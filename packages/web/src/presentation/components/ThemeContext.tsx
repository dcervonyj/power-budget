import React, { createContext, useContext } from 'react';
import { darkTheme, type Theme } from '@power-budget/design-tokens';

const ThemeContext = createContext<Theme>(darkTheme);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: React.ReactNode;
}): React.JSX.Element {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
