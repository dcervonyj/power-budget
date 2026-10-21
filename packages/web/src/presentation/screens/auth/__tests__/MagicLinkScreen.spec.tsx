import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { MagicLinkScreen } from '../MagicLinkScreen.js';
import { apiClient } from '../../../../AppProviders.js';

vi.mock('../../../../AppProviders.js', () => ({
  apiClient: { post: vi.fn() },
  tokenStore: { setTokens: vi.fn().mockResolvedValue(undefined) },
}));

const mockPost = vi.mocked(apiClient.post);

function apiError(status: number, code: string): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { statusCode: status, code, message: code } },
  });
}

function renderAt(path: string): void {
  render(
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter initialEntries={[path]}>
          <MagicLinkScreen />
        </MemoryRouter>
      </ThemeProvider>
    </IntlProvider>,
  );
}

describe('MagicLinkScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for the authenticator code on requires_totp and resends the link with it', async () => {
    mockPost.mockRejectedValueOnce(apiError(403, 'requires_totp')).mockResolvedValueOnce({
      status: 201,
      data: { accessToken: 'a', refreshToken: 'r' },
      headers: {},
    });
    renderAt('/auth/magic-link?token=link-1');

    const totp = await screen.findByLabelText('Authenticator code');
    fireEvent.change(totp, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(mockPost.mock.calls).toEqual([
        ['/auth/magic-link/consume', { token: 'link-1' }],
        ['/auth/magic-link/consume', { token: 'link-1', totp: '654321' }],
      ]);
    });
  });

  it('shows the expired-link message for other failures', async () => {
    mockPost.mockRejectedValueOnce(apiError(401, 'magic_link_expired'));
    renderAt('/auth/magic-link?token=old');

    expect(
      await screen.findByText('This link is invalid or has expired. Please request a new one.'),
    ).toBeDefined();
  });

  it('asks the user to wait when requesting a link is rate limited', async () => {
    mockPost.mockRejectedValueOnce(apiError(429, 'too_many_requests'));
    renderAt('/auth/magic-link');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(
      await screen.findByText('Too many attempts. Please wait a few minutes and try again.'),
    ).toBeDefined();
  });
});
