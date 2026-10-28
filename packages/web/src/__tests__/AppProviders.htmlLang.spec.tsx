import React, { useContext } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders, LocaleContext } from '../AppProviders.js';
import { stubLocalStorage } from '../presentation/theme/__tests__/matchMediaStub.js';

function PolishButton(): React.JSX.Element {
  const { setLocale } = useContext(LocaleContext);

  return (
    <button type="button" onClick={() => setLocale('pl')}>
      switch
    </button>
  );
}

describe('AppProviders html lang', () => {
  beforeEach(() => {
    stubLocalStorage().set('pb_locale', 'uk');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.lang = 'en';
  });

  it('sets <html lang> to the active locale and follows locale changes', async () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <PolishButton />
        </AppProviders>
      </MemoryRouter>,
    );

    await waitFor(() => expect(document.documentElement.lang).toBe('uk'));

    fireEvent.click(screen.getByText('switch'));

    await waitFor(() => expect(document.documentElement.lang).toBe('pl'));
  });
});
