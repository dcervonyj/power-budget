import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { createMock } from '@golevelup/ts-jest';
import type { ApiClient } from '@power-budget/shared-app';
import type { LocaleContextValue } from '../LocaleProvider.js';
import { ServerLocaleSync } from '../ServerLocaleSync.js';

const mockSetLocale = jest.fn();
const mockGet = jest.fn();
const mockApiClient = createMock<ApiClient>({ get: mockGet, sessionId: 4 });
const mockLocaleContext = createMock<LocaleContextValue>({
  locale: 'en',
  setLocale: mockSetLocale,
});

jest.mock('../LocaleProvider.js', () => ({
  useAppLocale: (): LocaleContextValue => mockLocaleContext,
}));
jest.mock('../../infrastructure/index.js', () => ({
  get apiClient(): ApiClient {
    return mockApiClient;
  },
}));

describe('ServerLocaleSync', () => {
  beforeEach(() => {
    mockSetLocale.mockReset();
    mockGet.mockReset().mockResolvedValue({ data: { locale: 'pl' } });
  });

  it('applies the profile language on authentication without opening Settings', async () => {
    await render(<ServerLocaleSync authenticated />);

    await waitFor(() => {
      expect(mockSetLocale).toHaveBeenCalledWith('pl', 'server', 4);
    });
    expect(mockGet).toHaveBeenCalledWith('/users/me');
  });

  it('loads nothing while signed out', async () => {
    await render(<ServerLocaleSync authenticated={false} />);

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSetLocale).not.toHaveBeenCalled();
  });

  it('keeps the current language when the profile cannot be loaded', async () => {
    mockGet.mockRejectedValueOnce(new Error('offline'));
    await render(<ServerLocaleSync authenticated />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1);
    });
    expect(mockSetLocale).not.toHaveBeenCalled();
  });
});
