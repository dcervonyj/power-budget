import React from 'react';
import { IntlProvider } from 'react-intl';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/index.js';
import onboardingEn from '../../../../../assets/locales/en/onboarding.json';
import overlaysEn from '../../../../../assets/locales/en/glass-overlays.json';
import { OnboardingScreen } from '../OnboardingScreen.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockSetLocale = jest.fn();

jest.mock('../../../LocaleProvider.js', () => ({
  useAppLocale: (): { locale: string; setLocale: jest.Mock } => ({
    locale: 'en',
    setLocale: mockSetLocale,
  }),
}));

function renderScreen(
  complete: jest.Mock<Promise<void>, [{ language: string; baseCurrency: string }]>,
  onCompleted: () => void,
  getSessionId: () => number = () => 7,
): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" messages={{ ...onboardingEn, ...overlaysEn }}>
        <OnboardingScreen
          api={{ complete }}
          getSessionId={getSessionId}
          onCompleted={onCompleted}
        />
      </IntlProvider>
    </ThemeProvider>,
  );
}

describe('OnboardingScreen', () => {
  beforeEach(() => {
    mockSetLocale.mockReset();
  });

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

  it('applies the chosen language right after saving, under the session it was chosen in', async () => {
    const complete = jest.fn().mockResolvedValue(undefined);
    await renderScreen(complete, jest.fn());

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(mockSetLocale).toHaveBeenCalledWith('en', 'user', 7);
    });
  });

  it('does not change the language when saving fails', async () => {
    const complete = jest.fn().mockRejectedValue(new Error('offline'));
    await renderScreen(complete, jest.fn());

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByText('We could not save your choices. Try again.');
    expect(mockSetLocale).not.toHaveBeenCalled();
  });

  it('does not open the gate or change the language when the session changed during the save', async () => {
    let finishSave: () => void = () => undefined;
    const complete = jest.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const onCompleted = jest.fn();
    let sessionId = 7;
    await renderScreen(complete, onCompleted, () => sessionId);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    sessionId = 8;
    await act(async () => {
      finishSave();
    });

    expect(onCompleted).not.toHaveBeenCalled();
    expect(mockSetLocale).not.toHaveBeenCalled();
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
