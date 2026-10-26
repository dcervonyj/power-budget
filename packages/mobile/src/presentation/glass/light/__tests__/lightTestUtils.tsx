import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@testing-library/react-native';
import { glassLightTheme, glassThemeToRn } from '@power-budget/design-tokens/glass';
import { ThemeProvider } from '../../../theme/index.js';
import en from '../../../../../assets/locales/en/glass-light.json';
import pl from '../../../../../assets/locales/pl/glass-light.json';
import ru from '../../../../../assets/locales/ru/glass-light.json';
import uk from '../../../../../assets/locales/uk/glass-light.json';

export const glassLightRn = glassThemeToRn(glassLightTheme);

export const MESSAGES: Record<string, Record<string, string>> = { en, pl, ru, uk };

export function lightProviders(element: React.ReactElement, locale = 'en'): React.JSX.Element {
  return (
    <ThemeProvider>
      <IntlProvider locale={locale} messages={MESSAGES[locale]}>
        {element}
      </IntlProvider>
    </ThemeProvider>
  );
}

export function renderLight(element: React.ReactElement, locale = 'en') {
  return render(lightProviders(element, locale));
}
