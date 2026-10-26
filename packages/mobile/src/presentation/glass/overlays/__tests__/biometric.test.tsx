import React from 'react';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../theme/index.js';
import { BiometricOptInPrompt } from '../../../components/BiometricOptInPrompt.js';
import { BiometricPromptOverlay } from '../../../components/BiometricPromptOverlay.js';
import { ToastProvider } from '../Toast.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => true,
  useLoopsEnabled: (): boolean => false,
  useAppActive: (): boolean => true,
}));

const mockAuthenticate = jest.fn();
const mockSetEnabled = jest.fn();

jest.mock('../../../../infrastructure/index.js', () => ({
  biometricUnlockService: {
    authenticate: (message: string): Promise<boolean> => mockAuthenticate(message),
    setBiometricEnabled: (enabled: boolean): Promise<void> => mockSetEnabled(enabled),
  },
}));

function renderThemed(ui: React.ReactElement): ReturnType<typeof render> {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" defaultLocale="en">
        <ToastProvider>{ui}</ToastProvider>
      </IntlProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mockAuthenticate.mockReset();
  mockSetEnabled.mockReset().mockResolvedValue(undefined);
});

describe('BiometricOptInPrompt', () => {
  it('enables biometrics after a successful verification', async () => {
    mockAuthenticate.mockResolvedValue(true);
    const onDone = jest.fn();
    await renderThemed(<BiometricOptInPrompt onDone={onDone} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(mockSetEnabled).toHaveBeenCalledWith(true);
  });

  it('tells the user with a toast, not an alert, when verification fails', async () => {
    mockAuthenticate.mockResolvedValue(false);
    const onDone = jest.fn();
    await renderThemed(<BiometricOptInPrompt onDone={onDone} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText('Authentication failed. Biometric unlock was not enabled.'),
    ).toBeTruthy();
    expect(mockSetEnabled).not.toHaveBeenCalled();
  });

  it('stores the opt-out on Not Now', async () => {
    const onDone = jest.fn();
    await renderThemed(<BiometricOptInPrompt onDone={onDone} />);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Not Now' }));

    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
    expect(mockSetEnabled).toHaveBeenCalledWith(false);
  });
});

describe('BiometricPromptOverlay', () => {
  it('prompts on show and unlocks on success', async () => {
    mockAuthenticate.mockResolvedValue(true);
    const onSuccess = jest.fn();
    await renderThemed(<BiometricPromptOverlay visible onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(mockAuthenticate).toHaveBeenCalledWith('Unlock Power Budget');
  });

  it('shows the failure in an error banner and retries on press', async () => {
    mockAuthenticate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onSuccess = jest.fn();
    await renderThemed(<BiometricPromptOverlay visible onSuccess={onSuccess} />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Authentication failed. Try again.')).toBeTruthy();
    await act(async () => {
      await userEvent
        .setup()
        .press(screen.getByRole('button', { name: 'Use Biometrics / Passcode' }));
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('renders nothing visible while hidden', async () => {
    await renderThemed(<BiometricPromptOverlay visible={false} onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Use Biometrics / Passcode' })).toBeNull();
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
