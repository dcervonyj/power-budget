import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/index.js';
import { MESSAGES } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import type { TestLocale } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import addEn from '../../../../../../assets/locales/en/add.json';
import addPl from '../../../../../../assets/locales/pl/add.json';
import addRu from '../../../../../../assets/locales/ru/add.json';
import addUk from '../../../../../../assets/locales/uk/add.json';

const ADD: Record<TestLocale, Record<string, string>> = {
  en: addEn,
  pl: addPl,
  uk: addUk,
  ru: addRu,
};

export function renderAdd(element: React.ReactElement, locale: TestLocale = 'en') {
  return render(
    <ThemeProvider>
      <IntlProvider locale={locale} messages={{ ...MESSAGES[locale], ...ADD[locale] }}>
        {element}
      </IntlProvider>
    </ThemeProvider>,
  );
}
