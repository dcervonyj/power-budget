import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ServerLocaleSync } from '../ServerLocaleSync.js';

const mockSetLocale = jest.fn();
const mockGet = jest.fn();

jest.mock('../LocaleProvider.js', () => ({
  useAppLocale: (): object => ({ locale: 'en', setLocale: mockSetLocale }),
}));
jest.mock('../../infrastructure/index.js', () => ({
  apiClient: {
    get: (url: string): Promise<unknown> => mockGet(url),
    sessionId: 4,
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
