import React, { useContext } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';

const slowEnglish = vi.hoisted(() => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { gate, release: (): void => release() };
});

vi.mock('../../public/locales/en.json', async () => {
  await slowEnglish.gate;

  return { default: { 'stale.probe': 'english messages' } };
});
vi.mock('../../public/locales/pl.json', () => ({
  default: { 'stale.probe': 'polskie komunikaty' },
}));

import { AppProviders, LocaleContext } from '../AppProviders.js';

function SwitchToPolish(): React.JSX.Element {
  const { setLocale } = useContext(LocaleContext);
  React.useEffect(() => {
    setLocale('pl');
  }, [setLocale]);

  return <FormattedMessage id="stale.probe" defaultMessage="default" />;
}

describe('AppProviders', () => {
  it('keeps the messages of the current locale when the first, slower locale load finishes late', async () => {
    localStorage.setItem('pb_locale', 'en');

    render(
      <MemoryRouter>
        <AppProviders>
          <SwitchToPolish />
        </AppProviders>
      </MemoryRouter>,
    );
    await screen.findByText('polskie komunikaty');

    slowEnglish.release();
    await new Promise((resolve) => setTimeout(resolve, 50));

    await waitFor(() => {
      expect(screen.getByText('polskie komunikaty')).toBeTruthy();
    });
    expect(screen.queryByText('english messages')).toBeNull();
  });
});
