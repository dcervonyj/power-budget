import React from 'react';
import { IntlProvider } from 'react-intl';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/index.js';
import onboardingEn from '../../../../../assets/locales/en/onboarding.json';
import overlaysEn from '../../../../../assets/locales/en/glass-overlays.json';
import { OnboardingScreen } from '../OnboardingScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function renderScreen(
  complete: jest.Mock<Promise<void>, [{ language: string; baseCurrency: string }]>,
  onCompleted: () => void,
): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" messages={{ ...onboardingEn, ...overlaysEn }}>
        <OnboardingScreen api={{ complete }} onCompleted={onCompleted} />
      </IntlProvider>
    </ThemeProvider>,
  );
}

describe('OnboardingScreen', () => {
  it('saves the choices to the profile and then opens the app', async () => {
    const complete = jest.fn().mockResolvedValue(undefined);
    const onCompleted = jest.fn();
    await renderScreen(complete, onCompleted);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledTimes(1);
    });
    expect(complete).toHaveBeenCalledWith({ language: 'en', baseCurrency: 'PLN' });
  });

  it('stays on the screen and says so when saving fails', async () => {
    const complete = jest.fn().mockRejectedValue(new Error('offline'));
    const onCompleted = jest.fn();
    await renderScreen(complete, onCompleted);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('We could not save your choices. Try again.')).toBeTruthy();
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
