import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { darkTheme } from '@power-budget/design-tokens';
import { ThemeProvider } from '../../../components/ThemeContext.js';
import { LoginScreen } from '../LoginScreen.js';
import { tokenStore } from '../../../../composition.js';
import { spyOnApiClient } from '../../../../test/apiClientSpies.js';

const mockPost = spyOnApiClient().post;
const setTokens = vi.spyOn(tokenStore, 'setTokens');

function apiError(status: number, code: string): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { statusCode: status, code, message: code } },
  });
}

function renderLogin(): void {
  render(
    <IntlProvider locale="en" messages={{}}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter>
          <LoginScreen />
        </MemoryRouter>
      </ThemeProvider>
    </IntlProvider>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTokens.mockResolvedValue(undefined);
  });

  it('asks for the authenticator code on 403 requires_totp, then sends it', async () => {
    mockPost.mockRejectedValueOnce(apiError(403, 'requires_totp')).mockResolvedValueOnce({
      status: 201,
      data: { accessToken: 'a', refreshToken: 'r' },
      headers: {},
    });
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    const totp = await screen.findByLabelText('Authenticator code');
    fireEvent.change(totp, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenLastCalledWith('/auth/login', {
        email: 'a@b.c',
        password: 'secret',
        totp: '123456',
      });
    });
    expect(screen.queryByText('Invalid email or password.')).toBeNull();
  });

  it('shows invalid credentials for 401 invalid_credentials', async () => {
    mockPost.mockRejectedValueOnce(apiError(401, 'invalid_credentials'));
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password.')).toBeDefined();
    expect(screen.queryByLabelText('Authenticator code')).toBeNull();
  });

  it('asks the user to wait on 429 too_many_requests', async () => {
    mockPost.mockRejectedValueOnce(apiError(429, 'too_many_requests'));
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText('Too many attempts. Please wait a few minutes and try again.'),
    ).toBeDefined();
  });

  it('shows a generic error when the server fails', async () => {
    mockPost.mockRejectedValueOnce(apiError(500, 'internal_error'));
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeDefined();
  });

  it('returns to the page RequireAuth came from, e.g. the invite link', async () => {
    mockPost.mockResolvedValueOnce({
      status: 201,
      data: { accessToken: 'a', refreshToken: 'r' },
      headers: {},
    });
    render(
      <IntlProvider locale="en" messages={{}}>
        <ThemeProvider theme={darkTheme}>
          <MemoryRouter
            initialEntries={[
              {
                pathname: '/login',
                state: { from: { pathname: '/invite/accept', search: '?token=raw' } },
              },
            ]}
          >
            <Routes>
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/invite/accept" element={<p>invite-route</p>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </IntlProvider>,
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('invite-route')).toBeInTheDocument();
  });
});
