import React from 'react';
import { IntlProvider } from 'react-intl';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/index.js';
import onboardingEn from '../../../../../assets/locales/en/onboarding.json';
import overlaysEn from '../../../../../assets/locales/en/glass-overlays.json';
import { OnboardingProfileError } from '../OnboardingProfileError.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('OnboardingProfileError', () => {
  it('says the profile failed to load and retries on press', async () => {
    const onRetry = jest.fn();
    await render(
      <ThemeProvider>
        <IntlProvider locale="en" messages={{ ...onboardingEn, ...overlaysEn }}>
          <OnboardingProfileError onRetry={onRetry} />
        </IntlProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText('Failed to load your profile')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
