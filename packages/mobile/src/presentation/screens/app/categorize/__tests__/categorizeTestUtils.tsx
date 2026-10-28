import React from 'react';
import { IntlProvider } from 'react-intl';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/index.js';
import { MESSAGES } from '../../../../glass/atoms/__tests__/glassTestUtils.js';
import txEn from '../../../../../../assets/locales/en/tx.json';
import categorizeEn from '../../../../../../assets/locales/en/categorize.json';

/** Renders under the theme and the English glass + tx + categorize messages. */
export function renderCategorize(element: React.ReactElement) {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" messages={{ ...MESSAGES.en, ...txEn, ...categorizeEn }}>
        {element}
      </IntlProvider>
    </ThemeProvider>,
  );
}
