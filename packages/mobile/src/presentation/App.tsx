import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { IntlProvider } from 'react-intl';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { RootNavigator } from './navigation/RootNavigator.js';
import { LocaleResolver, LOCALE_STORAGE_KEY } from '../infrastructure/locale/index.js';
import type { SupportedLocale } from '../infrastructure/locale/index.js';
import type { RootStackParamList } from './navigation/types.js';
import { BiometricGate } from './components/BiometricGate.js';

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

async function loadMessages(locale: SupportedLocale): Promise<Record<string, string>> {
  switch (locale) {
    case 'uk':
      return (await import('../../assets/locales/uk.json')) as unknown as Record<string, string>;
    case 'ru':
      return (await import('../../assets/locales/ru.json')) as unknown as Record<string, string>;
    case 'pl':
      return (await import('../../assets/locales/pl.json')) as unknown as Record<string, string>;
    default:
      return (await import('../../assets/locales/en.json')) as unknown as Record<string, string>;
  }
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
    <IntlProvider locale={locale} messages={messages} defaultLocale="en">
      <BiometricGate>
        <NavigationContainer linking={linking}>
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </BiometricGate>
    </IntlProvider>
  );
}
