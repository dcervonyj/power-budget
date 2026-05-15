import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { IntlProvider } from 'react-intl';
import { useEffect, useState } from 'react';
import { RootNavigator } from './navigation/RootNavigator.js';

type SupportedLocale = 'en' | 'uk' | 'ru' | 'pl';

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

function resolveLocale(stored?: string | null): SupportedLocale {
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as SupportedLocale;
  }
  try {
    const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
    const lang = deviceLocale.split('-')[0] ?? 'en';
    if ((SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
      return lang as SupportedLocale;
    }
  } catch {
    // ignore locale detection errors
  }
  return 'en';
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
  const [locale] = useState<SupportedLocale>(() => resolveLocale(null));
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadMessages(locale).then(setMessages);
  }, [locale]);

  return (
    <IntlProvider locale={locale} messages={messages} defaultLocale="en">
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </IntlProvider>
  );
}
