import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { GEIST_FONTS } from './fonts.js';
import { useTheme } from './ThemeProvider.js';

export interface FontGateProps {
  readonly children: React.ReactNode;
}

/**
 * Holds the app back until Geist and the stored theme preference are ready, showing a
 * token-coloured view so there is no light/dark flash.
 * TODO: use expo-splash-screen (preventAutoHideAsync) here once a deps ticket adds it.
 */
export function FontGate({ children }: FontGateProps): React.JSX.Element {
  const { glass, isLoaded } = useTheme();
  const [fontsLoaded, fontError] = useFonts(GEIST_FONTS);

  useEffect(() => {
    if (fontError !== null) {
      console.warn('Failed to load Geist fonts', fontError);
    }
  }, [fontError]);

  if (!isLoaded || (!fontsLoaded && fontError === null)) {
    return (
      <View testID="font-gate-loading" style={{ flex: 1, backgroundColor: glass.colors.base }} />
    );
  }

  return <>{children}</>;
}
