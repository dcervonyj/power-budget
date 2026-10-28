import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/index.js';
import authEn from '../../../../../assets/locales/en/auth.json';
import overlaysEn from '../../../../../assets/locales/en/glass-overlays.json';

export function renderAuth(element: React.ReactElement): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" messages={{ ...authEn, ...overlaysEn }}>
        {element}
      </IntlProvider>
    </ThemeProvider>,
  );
}
