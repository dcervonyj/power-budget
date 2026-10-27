import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { IntlProvider } from 'react-intl';
import { ThemeProvider } from '../../../../theme/index.js';
import { useSettings } from '../useSettings.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../../../../theme/useMotion.js', () => ({
  useReducedMotion: (): boolean => true,
  useLoopsEnabled: (): boolean => false,
  useAppActive: (): boolean => true,
}));

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockClearTokens = jest.fn();
const mockCanUse = jest.fn();
const mockIsEnabled = jest.fn();
const mockSetEnabled = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('../../../../../infrastructure/index.js', () => ({
  LOCALE_STORAGE_KEY: 'pb_locale',
  apiClient: {
    get: (url: string): Promise<unknown> => mockGet(url),
    patch: (url: string, body: unknown): Promise<unknown> => mockPatch(url, body),
  },
  tokenStore: { clearTokens: (): Promise<void> => mockClearTokens() },
  biometricUnlockService: {
    canUseBiometrics: (): Promise<boolean> => mockCanUse(),
    isBiometricEnabled: (): Promise<boolean> => mockIsEnabled(),
    setBiometricEnabled: (enabled: boolean): Promise<void> => mockSetEnabled(enabled),
    authenticate: (reason: string): Promise<boolean> => mockAuthenticate(reason),
  },
}));

const PROFILE = {
  id: 'u1',
  email: 'anna@example.com',
  displayName: 'Anna',
  locale: 'en',
  localePreference: 'en',
  defaultLocale: 'en',
  baseCurrency: 'PLN',
  timezone: 'Europe/Warsaw',
  householdId: null,
};

function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <ThemeProvider>
      <IntlProvider locale="en" defaultLocale="en">
        {children}
      </IntlProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({ data: PROFILE });
  mockPatch
    .mockReset()
    .mockImplementation((_url: string, body: object) =>
      Promise.resolve({ data: { ...PROFILE, ...body } }),
    );
  mockClearTokens.mockReset().mockResolvedValue(undefined);
  mockCanUse.mockReset().mockResolvedValue(true);
  mockIsEnabled.mockReset().mockResolvedValue(false);
  mockSetEnabled.mockReset().mockResolvedValue(undefined);
  mockAuthenticate.mockReset().mockResolvedValue(true);
});

describe('useSettings', () => {
  it('loads GET /users/me into the view props', async () => {
    const { result } = await renderHook(useSettings, { wrapper });

    await waitFor(() => {
      expect(result.current.loadState).toBe('ready');
    });
    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(result.current.nameDraft).toBe('Anna');
    expect(result.current.baseCurrency).toBe('PLN');
    expect(result.current.biometricAvailable).toBe(true);
  });

  it('reports a load error', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    const { result } = await renderHook(useSettings, { wrapper });

    await waitFor(() => {
      expect(result.current.loadState).toBe('error');
    });
  });

  it('saves the trimmed name with PATCH /users/me', async () => {
    const { result } = await renderHook(useSettings, { wrapper });
    await waitFor(() => {
      expect(result.current.loadState).toBe('ready');
    });
    await act(async () => {
      result.current.onNameChange(' Anna K ');
    });
    await act(async () => {
      result.current.onNameSave();
    });

    await waitFor(() => {
      expect(result.current.nameSave).toBe('saved');
    });
    expect(mockPatch).toHaveBeenCalledWith('/users/me', { displayName: 'Anna K' });
  });

  it('patches language and currency, and flags a failed save', async () => {
    const { result } = await renderHook(useSettings, { wrapper });
    await waitFor(() => {
      expect(result.current.loadState).toBe('ready');
    });
    await act(async () => {
      result.current.onLocaleChange('pl');
    });
    expect(mockPatch).toHaveBeenCalledWith('/users/me', { locale: 'pl' });

    mockPatch.mockRejectedValue(new Error('500'));
    await act(async () => {
      result.current.onCurrencyChange('EUR');
    });
    await waitFor(() => {
      expect(result.current.preferencesError).toBe(true);
    });
    expect(mockPatch).toHaveBeenCalledWith('/users/me', { baseCurrency: 'EUR' });
  });

  it('stores the appearance on the device through the theme runtime', async () => {
    const { result } = await renderHook(useSettings, { wrapper });
    await act(async () => {
      result.current.onPreferenceChange('light');
    });

    expect(result.current.preference).toBe('light');
  });

  it('enables biometrics only after a successful verification', async () => {
    mockAuthenticate.mockResolvedValue(false);
    const { result } = await renderHook(useSettings, { wrapper });
    await act(async () => {
      result.current.onBiometricChange(true);
    });
    expect(mockSetEnabled).not.toHaveBeenCalled();

    mockAuthenticate.mockResolvedValue(true);
    await act(async () => {
      result.current.onBiometricChange(true);
    });
    await waitFor(() => {
      expect(result.current.biometricEnabled).toBe(true);
    });
    expect(mockSetEnabled).toHaveBeenCalledWith(true);
  });

  it('clears the tokens on sign out', async () => {
    const { result } = await renderHook(useSettings, { wrapper });
    await act(async () => {
      result.current.onSignOut();
    });

    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });
});
