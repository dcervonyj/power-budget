import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import type { GlassRnTheme } from '@power-budget/design-tokens/glass';
import { useGlass } from './ThemeProvider.js';

type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Builds a themed StyleSheet hook. The sheet is created once per resolved glass
 * theme (the theme objects are stable), so re-renders never rebuild styles.
 */
export function makeStyles<T extends NamedStyles<T>>(factory: (glass: GlassRnTheme) => T): () => T {
  return function useStyles(): T {
    const glass = useGlass();

    return useMemo(() => StyleSheet.create(factory(glass)), [glass]);
  };
}
