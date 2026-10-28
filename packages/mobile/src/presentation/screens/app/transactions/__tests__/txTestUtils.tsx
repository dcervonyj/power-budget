import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/index.js';
import { MESSAGES } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import txEn from '../../../../../../assets/locales/en/tx.json';

/** Renders under the theme and the English glass + tx messages. */
export function renderTx(element: React.ReactElement) {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" messages={{ ...MESSAGES.en, ...txEn }}>
        {element}
      </IntlProvider>
    </ThemeProvider>,
  );
}
