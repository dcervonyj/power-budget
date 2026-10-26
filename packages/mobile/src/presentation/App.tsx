import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { IntlProvider } from 'react-intl';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { RootNavigator } from './navigation/RootNavigator.js';
import {
  loadMessages,
  LocaleResolver,
  LOCALE_STORAGE_KEY,
} from '../infrastructure/locale/index.js';
import type { SupportedLocale } from '../infrastructure/locale/index.js';
import type { RootStackParamList } from './navigation/types.js';
import { BiometricGate } from './components/BiometricGate.js';
import {
  FontGate,
  ThemeProvider,
  toNavigationTheme,
  toStatusBarStyle,
  useGlass,
} from './theme/index.js';

const resolver = new LocaleResolver();

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

  return (
    <NavigationContainer linking={linking} theme={toNavigationTheme(glass)}>
      <RootNavigator />
      <StatusBar style={toStatusBarStyle(glass)} />
    </NavigationContainer>
  );
}

export function App(): React.JSX.Element {
  const [locale, setLocale] = useState<SupportedLocale>(() =>
    resolver.resolve(getDeviceLanguage()),
  );
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    void AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((stored) => {
        const resolved = resolver.resolve(getDeviceLanguage(), stored);
        setLocale(resolved);
        return loadMessages(resolved);
      })
      .then(setMessages);
  }, []);

  return (
    <ThemeProvider>
      <FontGate>
        <IntlProvider locale={locale} messages={messages} defaultLocale="en">
          <BiometricGate>
            <ThemedNavigation />
          </BiometricGate>
        </IntlProvider>
      </FontGate>
    </ThemeProvider>
  );
}
