import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { LoginView, type LoginViewProps } from '../LoginView.js';
import { MagicLinkView, type MagicLinkViewProps } from '../MagicLinkView.js';
import { OAuthCallbackView } from '../OAuthCallbackView.js';
import { RegisterView, type RegisterViewProps } from '../RegisterView.js';
import { TotpEnrollmentView, type TotpEnrollmentViewProps } from '../TotpEnrollmentView.js';
import { renderAuth } from './authTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const login: LoginViewProps = {
  email: 'anna@example.com',
  password: 'correct horse',
  totp: '',
  showTotp: false,
  loading: false,
  error: null,
  onEmailChange: jest.fn(),
  onPasswordChange: jest.fn(),
  onTotpChange: jest.fn(),
  onSubmit: jest.fn(),
  onForgotPassword: jest.fn(),
  onCreateAccount: jest.fn(),
};

const register: RegisterViewProps = {
  email: 'anna@example.com',
  password: 'correct horse',
  locale: 'en',
  loading: false,
  error: null,
  sent: false,
  onEmailChange: jest.fn(),
  onPasswordChange: jest.fn(),
  onLocaleChange: jest.fn(),
  onSubmit: jest.fn(),
  onBackToLogin: jest.fn(),
};

const magicLink: MagicLinkViewProps = {
  sent: false,
  email: 'anna@example.com',
  loading: false,
  error: null,
  onEmailChange: jest.fn(),
  onSubmit: jest.fn(),
  onBackToLogin: jest.fn(),
};

const totp: TotpEnrollmentViewProps = {
  phase: 'qr',
  qrCodeUri: 'otpauth://totp/Power%20Budget:anna@example.com?secret=JBSWY3DPEHPK3PXP',
  secret: 'JBSW Y3DP EHPK 3PXP',
  code: '',
  verifying: false,
  error: null,
  recoveryCodes: [],
  copied: false,
  onCodeChange: jest.fn(),
  onCopySecret: jest.fn(),
  onOpenAuthenticator: jest.fn(),
  onVerify: jest.fn(),
  onCopyCodes: jest.fn(),
  onDone: jest.fn(),
};

describe('LoginView', () => {
  it('submits and opens the secondary routes', async () => {
    const onSubmit = jest.fn();
    const onForgotPassword = jest.fn();
    const onCreateAccount = jest.fn();
    await renderAuth(
      <LoginView
        {...login}
        onSubmit={onSubmit}
        onForgotPassword={onForgotPassword}
        onCreateAccount={onCreateAccount}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Create account' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });

  it('reports typed email and password', async () => {
    const onEmailChange = jest.fn();
    const onPasswordChange = jest.fn();
    await renderAuth(
      <LoginView {...login} onEmailChange={onEmailChange} onPasswordChange={onPasswordChange} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Email'), 'b@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret');

    expect(onEmailChange).toHaveBeenCalledWith('b@example.com');
    expect(onPasswordChange).toHaveBeenCalledWith('secret');
  });

  it('hides the authenticator code field until the server asks for it', async () => {
    await renderAuth(<LoginView {...login} />);

    expect(screen.queryByLabelText('Authenticator code')).toBeNull();
  });

  it('renders the code field with the hint when showTotp is set', async () => {
    const onTotpChange = jest.fn();
    await renderAuth(<LoginView {...login} showTotp onTotpChange={onTotpChange} />);

    await fireEvent.changeText(screen.getByLabelText('Authenticator code'), '123456');

    expect(onTotpChange).toHaveBeenCalledWith('123456');
    expect(screen.getByText(/Two-factor authentication is on/)).toBeTruthy();
  });

  it.each([
    ['required', 'Email and password are required.'],
    ['invalidCredentials', 'Invalid email or password.'],
    ['invalidTotp', 'Invalid authenticator code.'],
    ['tooManyAttempts', 'Too many attempts. Please wait a few minutes and try again.'],
    ['serverError', 'Something went wrong. Please try again.'],
  ] as const)('announces the %s error as an alert', async (error, text) => {
    await renderAuth(<LoginView {...login} error={error} />);

    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('disables the submit button while loading', async () => {
    await renderAuth(<LoginView {...login} loading />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled();
  });
});

describe('RegisterView', () => {
  it('submits and returns to login', async () => {
    const onSubmit = jest.fn();
    const onBackToLogin = jest.fn();
    await renderAuth(
      <RegisterView {...register} onSubmit={onSubmit} onBackToLogin={onBackToLogin} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Already have an account? Log in' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });

  it('shows the duplicate email error', async () => {
    await renderAuth(<RegisterView {...register} error="emailInUse" />);

    expect(screen.getByText('An account with this email already exists.')).toBeTruthy();
  });

  it('replaces the form with the confirmation once sent', async () => {
    const onBackToLogin = jest.fn();
    await renderAuth(<RegisterView {...register} sent onBackToLogin={onBackToLogin} />);

    expect(screen.getByText('We sent a confirmation link to anna@example.com.')).toBeTruthy();
    expect(screen.queryByLabelText('Password')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to log in' }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});

describe('MagicLinkView', () => {
  it('requests the link', async () => {
    const onSubmit = jest.fn();
    await renderAuth(<MagicLinkView {...magicLink} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['required', 'Email is required.'],
    ['requestFailed', 'Could not send the link. Please try again.'],
    ['tooManyAttempts', 'Too many attempts. Please wait a few minutes and try again.'],
  ] as const)('shows the %s error', async (error, text) => {
    await renderAuth(<MagicLinkView {...magicLink} error={error} />);

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('shows the sent confirmation with the email', async () => {
    await renderAuth(<MagicLinkView {...magicLink} sent />);

    expect(screen.getByText('We sent a sign-in link to anna@example.com.')).toBeTruthy();
  });
});

describe('OAuthCallbackView', () => {
  it('shows progress while completing sign in', async () => {
    await renderAuth(<OAuthCallbackView failed={false} onBackToLogin={jest.fn()} />);

    expect(screen.getByText('Completing sign in…')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the failure and a way back', async () => {
    const onBackToLogin = jest.fn();
    await renderAuth(<OAuthCallbackView failed onBackToLogin={onBackToLogin} />);

    expect(screen.getByText('Sign in with Google failed. Please try again.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to log in' }));
    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});

describe('TotpEnrollmentView', () => {
  it('shows a status while enrolment starts', async () => {
    await renderAuth(<TotpEnrollmentView {...totp} phase="loading" />);

    expect(screen.getByText('Setting up two-factor authentication…')).toBeTruthy();
  });

  it('shows the manual key, copies it and verifies the typed code', async () => {
    const onCopySecret = jest.fn();
    const onCodeChange = jest.fn();
    const onVerify = jest.fn();
    await renderAuth(
      <TotpEnrollmentView
        {...totp}
        onCopySecret={onCopySecret}
        onCodeChange={onCodeChange}
        onVerify={onVerify}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Copy JBSW Y3DP EHPK 3PXP' }));
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '482915');
    await fireEvent.press(screen.getByRole('button', { name: 'Verify' }));

    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeTruthy();
    expect(onCopySecret).toHaveBeenCalledTimes(1);
    expect(onCodeChange).toHaveBeenCalledWith('482915');
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  it('opens the authenticator app', async () => {
    const onOpenAuthenticator = jest.fn();
    await renderAuth(<TotpEnrollmentView {...totp} onOpenAuthenticator={onOpenAuthenticator} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open in authenticator' }));

    expect(onOpenAuthenticator).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['setupFailed', 'Could not set up two-factor authentication. Please try again.'],
    ['codeInvalid', 'Please enter the 6-digit code.'],
    ['codeWrong', 'Invalid code. Please try again.'],
    ['noAuthenticator', 'No authenticator app found. Install one from the app store.'],
  ] as const)('shows the %s error', async (error, text) => {
    await renderAuth(<TotpEnrollmentView {...totp} error={error} />);

    expect(screen.getByText(text)).toBeTruthy();
  });

  it('shows the recovery step with copy, share and done', async () => {
    const onCopyCodes = jest.fn();
    const onDone = jest.fn();
    await renderAuth(
      <TotpEnrollmentView
        {...totp}
        phase="recovery"
        recoveryCodes={['AAAA-1111', 'BBBB-2222']}
        copied
        onCopyCodes={onCopyCodes}
        onDone={onDone}
      />,
    );

    expect(screen.getByText('AAAA-1111')).toBeTruthy();
    expect(screen.getByText('Recovery codes copied to clipboard.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy all' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onCopyCodes).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
