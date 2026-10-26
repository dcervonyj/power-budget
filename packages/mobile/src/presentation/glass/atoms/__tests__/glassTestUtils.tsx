import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/index.js';
import atomsEn from '../../../../../assets/locales/en/glass-atoms.json';
import atomsPl from '../../../../../assets/locales/pl/glass-atoms.json';
import atomsRu from '../../../../../assets/locales/ru/glass-atoms.json';
import atomsUk from '../../../../../assets/locales/uk/glass-atoms.json';
import lightEn from '../../../../../assets/locales/en/glass-light.json';
import lightPl from '../../../../../assets/locales/pl/glass-light.json';
import lightRu from '../../../../../assets/locales/ru/glass-light.json';
import lightUk from '../../../../../assets/locales/uk/glass-light.json';
import rowsEn from '../../../../../assets/locales/en/glass-rows.json';
import rowsPl from '../../../../../assets/locales/pl/glass-rows.json';
import rowsRu from '../../../../../assets/locales/ru/glass-rows.json';
import rowsUk from '../../../../../assets/locales/uk/glass-rows.json';

export const LOCALES = ['en', 'pl', 'uk', 'ru'] as const;
export type TestLocale = (typeof LOCALES)[number];

export const MESSAGES: Record<TestLocale, Record<string, string>> = {
  en: { ...atomsEn, ...lightEn, ...rowsEn },
  pl: { ...atomsPl, ...lightPl, ...rowsPl },
  uk: { ...atomsUk, ...lightUk, ...rowsUk },
  ru: { ...atomsRu, ...lightRu, ...rowsRu },
};

const NBSP = /[  ]/g;

/** Intl money output uses no-break spaces; tests compare with plain ones. */
export function plain(text: string): string {
  return text.replace(NBSP, ' ');
}

export function glassProviders(
  element: React.ReactElement,
  locale: TestLocale = 'en',
): React.JSX.Element {
  return (
    <ThemeProvider>
      <IntlProvider locale={locale} messages={MESSAGES[locale]}>
        {element}
      </IntlProvider>
    </ThemeProvider>
  );
}

export function renderGlass(element: React.ReactElement, locale: TestLocale = 'en') {
  return render(glassProviders(element, locale));
}
