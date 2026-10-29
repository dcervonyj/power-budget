import { createMock } from '@golevelup/ts-vitest';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { BankConsentCallbackView } from '../BankConsentCallbackView.js';
import { LoginView, type LoginViewProps } from '../LoginView.js';
import { MagicLinkView, type MagicLinkViewProps } from '../MagicLinkView.js';
import { TotpEnrollmentView, type TotpEnrollmentViewProps } from '../TotpEnrollmentView.js';

function renderView(view: React.JSX.Element): void {
  render(
    <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
      <MemoryRouter>{view}</MemoryRouter>
    </IntlProvider>,
  );
}

const LOGIN = createMock<LoginViewProps>({
  email: 'anna@example.com',
  password: 'secret',
  totp: '',
  showTotp: false,
  loading: false,
  error: null,
  onEmailChange: vi.fn(),
  onPasswordChange: vi.fn(),
  onTotpChange: vi.fn(),
  onSubmit: vi.fn(),
});

const MAGIC = createMock<MagicLinkViewProps>({
  stage: 'request',
  email: '',
  totp: '',
  showTotp: false,
  loading: false,
  error: null,
  onEmailChange: vi.fn(),
  onTotpChange: vi.fn(),
  onRequestSubmit: vi.fn(),
  onTotpSubmit: vi.fn(),
});

const TOTP = createMock<TotpEnrollmentViewProps>({
  enrollment: { qrCodeUri: 'otpauth://totp/PB:a@b.c?secret=ABC', secret: 'ABCD EFGH' },
  loadError: null,
  code: '',
  verifyError: null,
  verifying: false,
  onCodeChange: vi.fn(),
  onSubmit: vi.fn(),
});

describe('LoginView', () => {
  it('names the page with a heading and offers the magic link and register routes', () => {
    renderView(<LoginView {...LOGIN} />);

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/auth/magic-link',
    );
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('shows the two-factor hint and a numeric 6-digit code field when 2FA is required', () => {
    renderView(<LoginView {...LOGIN} showTotp />);

    expect(screen.getByText(/Enter the 6-digit code from your authenticator app/)).toBeVisible();
    const code = screen.getByLabelText('Authenticator code');
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(code).toHaveAttribute('maxlength', '6');
    expect(code).toHaveAttribute('aria-invalid', 'false');
  });

  it('marks a wrong password as an alert and a wrong code on the code field', () => {
    renderView(<LoginView {...LOGIN} showTotp error="invalidTotp" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid authenticator code.');
    expect(screen.getByLabelText('Authenticator code')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('MagicLinkView', () => {
  it('shows the sent state with a way back to log in and no form', () => {
    renderView(<MagicLinkView {...MAGIC} stage="sent" />);

    expect(screen.getByText('Check your email — we sent you a sign-in link.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Send sign-in link' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to log in' })).toHaveAttribute('href', '/login');
  });

  it('offers a new link after an expired one', () => {
    renderView(<MagicLinkView {...MAGIC} stage="consume" error="consumeFailed" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This link is invalid or has expired. Please request a new one.',
    );
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/auth/magic-link',
    );
  });
});

describe('TotpEnrollmentView', () => {
  it('groups the 6-digit code under its instruction and shows the QR code on a card', () => {
    renderView(<TotpEnrollmentView {...TOTP} />);

    const group = screen.getByRole('group', {
      name: 'Enter the 6-digit code from your app to confirm',
    });
    expect(within(group).getByLabelText('6-digit code')).toBeVisible();
    expect(screen.getByTitle('QR code for your authenticator app')).toBeInTheDocument();
    expect(screen.getByText('ABCD EFGH')).toBeVisible();
  });

  it('shows an invalid code as an alert', () => {
    renderView(<TotpEnrollmentView {...TOTP} verifyError="invalid" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code. Please try again.');
  });

  it('shows the already-enabled error instead of the QR code', () => {
    renderView(<TotpEnrollmentView {...TOTP} enrollment={null} loadError="alreadyEnabled" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Two-factor authentication is already enabled.',
    );
    expect(screen.queryByTitle('QR code for your authenticator app')).toBeNull();
  });
});

describe('BankConsentCallbackView', () => {
  it('says the connection is completing, or that consent failed', () => {
    const { rerender } = render(
      <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
        <BankConsentCallbackView failed={false} />
      </IntlProvider>,
    );
    expect(screen.getByText('Completing bank connection…')).toBeVisible();

    rerender(
      <IntlProvider locale="en" messages={{}} onError={vi.fn()}>
        <BankConsentCallbackView failed />
      </IntlProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Bank consent failed. Please try again.');
  });
});
