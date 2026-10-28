import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  /**
   * Switches the active language at runtime. Priority: user choice > server profile > stored
   * launch value; a lower source never overrides a higher one that was already applied.
   * A user choice is also stored for the next launch.
   */
  readonly setLocale: (locale: SupportedLocale, source?: LocaleSource) => void;
}

export type LocaleSource = 'stored' | 'server' | 'user';

const SOURCE_RANK: Record<LocaleSource, number> = { stored: 1, server: 2, user: 3 };

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
});

const resolver = new LocaleResolver();

export interface LocaleProviderProps {
  readonly deviceLanguage: string;
  /** Changes whenever the signed-in session changes; the previous user's choices stop counting. */
  readonly sessionKey?: boolean;
  readonly children: React.ReactNode;
}

/** Owns the active locale and its messages; useAppLocale() changes them without a restart. */
export function LocaleProvider({
  deviceLanguage,
  sessionKey = false,
  children,
}: LocaleProviderProps): React.JSX.Element {
  const [locale, setLocaleState] = useState<SupportedLocale>(() =>
    resolver.resolve(deviceLanguage),
  );
  const [messages, setMessages] = useState<Record<string, string>>({});

  const appliedRank = useRef(0);
  const request = useRef(0);

  const setLocale = useCallback((next: SupportedLocale, source: LocaleSource = 'user'): void => {
    const rank = SOURCE_RANK[source];
    if (rank < appliedRank.current) {
      return;
    }
    appliedRank.current = rank;
    request.current += 1;
    const id = request.current;
    if (source === 'user') {
      void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
    void loadMessages(next).then((loaded) => {
      if (id === request.current) {
        setMessages(loaded);
        setLocaleState(next);
      }
    });
  }, []);

  useEffect(() => {
    appliedRank.current = 0;
  }, [sessionKey]);

  useEffect(() => {
    void AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((stored) => {
      setLocale(resolver.resolve(deviceLanguage, stored), 'stored');
    });
  }, [setLocale, deviceLanguage]);

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
