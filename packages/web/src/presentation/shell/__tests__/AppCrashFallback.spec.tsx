import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { AppCrashFallback } from '../AppCrashFallback.js';

describe('AppCrashFallback', () => {
  it('shows the translated message and reloads on click', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    render(
      <IntlProvider
        locale="pl"
        messages={{
          'shell.crash.message': 'Coś poszło nie tak.',
          'shell.crash.reload': 'Załaduj ponownie',
        }}
      >
        <AppCrashFallback />
      </IntlProvider>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Coś poszło nie tak.');
    fireEvent.click(screen.getByRole('button', { name: 'Załaduj ponownie' }));

    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
