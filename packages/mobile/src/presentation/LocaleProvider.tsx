import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IntlProvider } from 'react-intl';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadMessages,
  LocaleResolver,
  LOCALE_STORAGE_KEY,
} from '../infrastructure/locale/index.js';
import type { SupportedLocale } from '../infrastructure/locale/index.js';

export interface LocaleContextValue {
  readonly locale: SupportedLocale;
  /** Switches the active language at runtime and stores it for the next launch. */
  readonly setLocale: (locale: SupportedLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
});

const resolver = new LocaleResolver();

export interface LocaleProviderProps {
  readonly deviceLanguage: string;
  readonly children: React.ReactNode;
}

/** Owns the active locale and its messages; useAppLocale() changes them without a restart. */
export function LocaleProvider({
  deviceLanguage,
  children,
}: LocaleProviderProps): React.JSX.Element {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    resolver.resolve(deviceLanguage),
  );
  const [messages, setMessages] = useState<Record<string, string>>({});

  const apply = useCallback(async (next: SupportedLocale): Promise<void> => {
    const loaded = await loadMessages(next);
    setMessages(loaded);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((stored) =>
      apply(resolver.resolve(deviceLanguage, stored)),
    );
  }, [apply, deviceLanguage]);

  const setLocale = useCallback(
    (next: SupportedLocale): void => {
      void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
      void apply(next);
    },
    [apply],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <IntlProvider locale={locale} messages={messages} defaultLocale="en">
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
