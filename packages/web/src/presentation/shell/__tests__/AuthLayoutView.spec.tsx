import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthLayoutView } from '../AuthLayoutView.js';
import { LocaleSelect } from '../LocaleSelect.js';

describe('AuthLayoutView', () => {
  it('puts the screen in main and the brand and language in the banner', () => {
    const onChange = vi.fn();
    render(
      <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
        <MemoryRouter>
          <AuthLayoutView
            language={<LocaleSelect id="auth-locale" locale="uk" onChange={onChange} />}
          >
            <h1>Log in</h1>
          </AuthLayoutView>
        </MemoryRouter>
      </IntlProvider>,
    );

    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('Power Budget');
    expect(within(banner).queryByRole('link')).toBeNull();
    expect(within(banner).getByLabelText('Language')).toHaveValue('uk');
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Log in' })).toBeVisible();
  });
});
