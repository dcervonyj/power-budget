import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { staleChunkRecovery } from './infrastructure/lazyChunk.js';
import { navigationAdapter } from './composition.js';
import { ThemeProvider } from './presentation/theme/ThemeProvider.js';

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

// Vite precompiles the locale JSON into ICU ASTs (precompiledMessages plugin); specs load the raw strings.
type Messages = Record<string, string> | Record<string, MessageFormatElement[]>;
type MessagesModule = { default: Messages };

const featureMessageModules = import.meta.glob<MessagesModule>('../public/locales/*/*.json');

// A dynamic import of a JSON file resolves to a module object; the messages are
// its `default` export. Passing the module itself to IntlProvider made every
// non-English string fall back to the default message.
function importMessages(locale: SupportedLocale): Promise<MessagesModule> {
  switch (locale) {
    case 'uk':
      return import('../public/locales/uk.json');
    case 'ru':
      return import('../public/locales/ru.json');
    case 'pl':
      return import('../public/locales/pl.json');
    case 'en':
      return import('../public/locales/en.json');
  }
}

export async function loadMessages(locale: SupportedLocale): Promise<Messages> {
  const legacyMessages = await importMessages(locale);
  const featureEntries = Object.entries(featureMessageModules)
    .filter(([path]) => path.includes(`/locales/${locale}/`))
    .sort(([left], [right]) => left.localeCompare(right));
  const featureModules = await Promise.all(featureEntries.map(([, load]) => load()));

  return Object.assign(
    {},
    legacyMessages.default,
    ...featureModules.map((module) => module.default),
  );
}

/**
 * Inner component that has access to the router context and wires up the
 * navigation adapter's imperative navigate function and current location.
 */
function NavigationWirer(): null {
  const navigate = useNavigate();
  const location = useLocation();
  const adapterRef = useRef(navigationAdapter);

  useEffect(() => {
    adapterRef.current.setNavigate(navigate);
  }, [navigate]);

  useEffect(() => {
    adapterRef.current.setLocation(location);
  }, [location]);

  return null;
}

/**
 * AppProviders is the composition root for the web app.
 * Wraps children with IntlProvider (react-intl) plus platform adapters.
 */
export function AppProviders({ children }: AppProvidersProps): React.JSX.Element {
  const [locale, setLocale] = useState<SupportedLocale>(resolveLocale);
  const [messages, setMessages] = useState<Messages>({});

  const [loadError, setLoadError] = useState<unknown>(undefined);

  function onMessagesLoaded(loaded: Messages): void {
    staleChunkRecovery.chunkLoaded('locale');
    setMessages(loaded);
  }

  useEffect(() => {
    loadMessages(locale).then(onMessagesLoaded, setLoadError);
  }, [locale]);

  // Screen readers pick the voice from <html lang>, which index.html fixes to "en".
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (loadError !== undefined) {
    // Rethrown during render so the outer error boundary shows the Reload fallback.
    throw loadError;
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <IntlProvider locale={locale} messages={messages} defaultLocale="en">
        <ThemeProvider>
          <NavigationWirer />
          {children}
        </ThemeProvider>
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
