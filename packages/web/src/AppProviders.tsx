import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { LocalStorageTokenStore } from './infrastructure/tokens/LocalStorageTokenStore.js';
import { ReactRouterNavigationAdapter } from './infrastructure/navigation/ReactRouterNavigationAdapter.js';
import { createApiClient } from './infrastructure/api/ApiClient.js';

export interface AppProvidersProps {
  children: React.ReactNode;
}

export type SupportedLocale = 'en' | 'uk' | 'ru' | 'pl';

interface LocaleContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
}

export const LocaleContext = React.createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
});

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

function resolveLocale(): SupportedLocale {
  const stored = localStorage.getItem('pb_locale');
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as SupportedLocale;
  }
  const browser = navigator.language.split('-')[0] ?? 'en';
  return (SUPPORTED_LOCALES as readonly string[]).includes(browser)
    ? (browser as SupportedLocale)
    : 'en';
}

async function loadMessages(locale: SupportedLocale): Promise<Record<string, string>> {
  switch (locale) {
    case 'uk':
      return (await import('../public/locales/uk.json')) as unknown as Record<string, string>;
    case 'ru':
      return (await import('../public/locales/ru.json')) as unknown as Record<string, string>;
    case 'pl':
      return (await import('../public/locales/pl.json')) as unknown as Record<string, string>;
    default:
      return (await import('../public/locales/en.json')) as unknown as Record<string, string>;
  }
}

// Singleton infrastructure adapters — created once, wired at runtime.
export const tokenStore = new LocalStorageTokenStore();
export const navigationAdapter = new ReactRouterNavigationAdapter();
export const apiClient = createApiClient(tokenStore, () => {
  navigationAdapter.navigate({ type: 'auth/login' });
});

/**
 * Inner component that has access to the router context and wires up the
 * navigation adapter's imperative navigate function.
 */
function NavigationWirer(): null {
  const navigate = useNavigate();
  const adapterRef = useRef(navigationAdapter);

  useEffect(() => {
    adapterRef.current.setNavigate(navigate);
  }, [navigate]);

  return null;
}

/**
 * AppProviders is the composition root for the web app.
 * Wraps children with IntlProvider (react-intl) plus platform adapters.
 */
export function AppProviders({ children }: AppProvidersProps): React.JSX.Element {
  const [locale, setLocale] = useState<SupportedLocale>(resolveLocale);
  const [messages, setMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadMessages(locale).then(setMessages);
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <IntlProvider locale={locale} messages={messages} defaultLocale="en">
        <NavigationWirer />
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
