import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';
import type { GlassRnTheme } from '@power-budget/design-tokens/glass';

export function toNavigationTheme(glass: GlassRnTheme): Theme {
  const base = glass.name === 'light' ? DefaultTheme : DarkTheme;

  return {
    ...base,
    dark: glass.name !== 'light',
    colors: {
      primary: glass.colors.accent,
      background: glass.colors.base,
      card: glass.colors.base,
      text: glass.colors.fg,
      border: glass.colors.sep,
      notification: glass.colors.over,
    },
  };
}

export function toStatusBarStyle(glass: GlassRnTheme): 'light' | 'dark' {
  return glass.name === 'light' ? 'dark' : 'light';
}
