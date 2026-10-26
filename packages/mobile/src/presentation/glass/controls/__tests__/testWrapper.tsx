import React from 'react';
import { render } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../theme/index.js';

export async function renderWithProviders(ui: React.ReactElement): Promise<void> {
  await render(
    <ThemeProvider>
      <IntlProvider locale="en" defaultLocale="en">
        {ui}
      </IntlProvider>
    </ThemeProvider>,
  );
}
