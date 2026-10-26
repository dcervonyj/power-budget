import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleContext, apiClient, tokenStore } from '../../../AppProviders.js';
import { stubLocalStorage } from '../../theme/__tests__/matchMediaStub.js';
import { LocaleSwitcher } from '../LocaleSwitcher.js';

vi.mock('../../../AppProviders.js', async () => {
  const react = await import('react');

  return {
    LocaleContext: react.createContext({ locale: 'en', setLocale: () => undefined }),
    apiClient: { patch: vi.fn() },
    tokenStore: { getAccessToken: vi.fn() },
  };
});

const mockPatch = vi.mocked(apiClient.patch);
const mockAccessToken = vi.mocked(tokenStore.getAccessToken);

function renderSwitcher(setLocale: (locale: 'en' | 'uk' | 'ru' | 'pl') => void): void {
  render(
    <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
      <LocaleContext.Provider value={{ locale: 'en', setLocale }}>
        <LocaleSwitcher />
      </LocaleContext.Provider>
    </IntlProvider>,
  );
}

describe('LocaleSwitcher', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = stubLocalStorage();
    mockPatch.mockReset();
    mockPatch.mockResolvedValue({ status: 200, data: undefined, headers: {} });
    mockAccessToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the language, stores it and saves it to the profile when signed in', () => {
    mockAccessToken.mockReturnValue('access');
    const setLocale = vi.fn();
    renderSwitcher(setLocale);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'pl' } });

    expect(setLocale).toHaveBeenCalledWith('pl');
    expect(storage.get('pb_locale')).toBe('pl');
    expect(mockPatch).toHaveBeenCalledWith('/users/me/locale', { locale: 'pl' });
  });

  it('does not call the API on the auth pages (signed out)', () => {
    mockAccessToken.mockReturnValue(null);
    const setLocale = vi.fn();
    renderSwitcher(setLocale);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'uk' } });

    expect(setLocale).toHaveBeenCalledWith('uk');
    expect(storage.get('pb_locale')).toBe('uk');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('lists every language in its own name', () => {
    renderSwitcher(vi.fn());

    expect(
      Array.from(screen.getByLabelText<HTMLSelectElement>('Language').options).map(
        (option) => option.textContent,
      ),
    ).toEqual(['English', 'Українська', 'Русский', 'Polski']);
  });
});
