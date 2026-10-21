import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { IntlProvider, ReactIntlErrorCode, type IntlConfig } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../presentation/components/ThemeContext.js';

export interface RenderOptions {
  readonly locale?: string;
  /** The URL the router starts at. */
  readonly url?: string;
  /** Route path the element is mounted under; other paths render their path as text. */
  readonly path?: string;
}

/** Tests use the default (English) messages, so other locales only change number formats. */
const ignoreMissingTranslation: IntlConfig['onError'] = (error) => {
  if (error.code !== ReactIntlErrorCode.MISSING_TRANSLATION) {
    throw error;
  }
};

/** Renders with intl (default messages), the dark theme and a memory router. */
export function renderWithProviders(
  element: React.ReactElement,
  { locale = 'en', url = '/', path = '*' }: RenderOptions = {},
): RenderResult {
  return render(
    <IntlProvider locale={locale} messages={{}} onError={ignoreMissingTranslation}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path={path} element={element} />
            <Route path="/household" element={<p>household-route</p>} />
            <Route path="/dashboard" element={<p>dashboard-route</p>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </IntlProvider>,
  );
}
