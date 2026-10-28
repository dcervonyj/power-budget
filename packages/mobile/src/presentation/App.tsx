import React, { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { getLocales } from 'expo-localization';
import { RootNavigator } from './navigation/RootNavigator.js';
import { LocaleProvider } from './LocaleProvider.js';
import type { RootStackParamList } from './navigation/types.js';
import { tokenStore } from '../infrastructure/index.js';
import { AuthGate } from './AuthGate.js';
import { BiometricGate } from './components/BiometricGate.js';
import {
  FontGate,
  ThemeProvider,
  toNavigationTheme,
  toStatusBarStyle,
  useGlass,
} from './theme/index.js';

function loadStoredTokens(): Promise<void> {
  return tokenStore.load();
}

/**
 * Deep linking configuration.
 *
 * Supported URLs:
 *   Universal:  https://app.power-budget.com/auth/magic-link?token=<token>
 *   Universal:  https://app.power-budget.com/auth/oauth/google/callback?code=<code>&state=<state>
 *   Custom scheme: powerbudget://auth/magic-link?token=<token>
 *   Custom scheme: powerbudget://auth/oauth/google/callback?code=<code>&state=<state>
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://app.power-budget.com', 'powerbudget://'],
  config: {
    screens: {
      Auth: {
        screens: {
          MagicLink: 'auth/magic-link',
          OAuthCallback: 'auth/oauth/google/callback',
        },
      },
      App: {
        screens: {
          Tabs: {
            screens: {
              Dashboard: 'dashboard',
              Plans: 'plans',
            },
          },
        },
      },
    },
  },
};

function getDeviceLanguage(): string {
  return getLocales()[0]?.languageCode ?? 'en';
}

function ThemedNavigation(): React.JSX.Element {
  const glass = useGlass();
  const navigationTheme = useMemo(() => toNavigationTheme(glass), [glass]);

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <RootNavigator />
      <StatusBar style={toStatusBarStyle(glass)} />
    </NavigationContainer>
  );
}

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <FontGate>
        <LocaleProvider deviceLanguage={getDeviceLanguage()}>
          <AuthGate loadTokens={loadStoredTokens}>
            <BiometricGate>
              <ThemedNavigation />
            </BiometricGate>
          </AuthGate>
        </LocaleProvider>
      </FontGate>
    </ThemeProvider>
  );
}
