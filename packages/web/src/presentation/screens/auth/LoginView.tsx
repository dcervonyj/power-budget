import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button, Input } from '../../components/index.js';
import {
  AUTH_FORM_STYLE,
  AuthHeading,
  AuthLink,
  AuthLinks,
  AuthNotice,
  AuthStatus,
  CodeField,
} from './AuthParts.js';

export type LoginError = 'invalidCredentials' | 'invalidTotp' | 'tooManyAttempts' | 'serverError';

export interface LoginViewProps {
  readonly email: string;
  readonly password: string;
  readonly totp: string;
  /** The server asked for the authenticator code (403 requires_totp). */
  readonly showTotp: boolean;
  readonly loading: boolean;
  readonly error: LoginError | null;
  /** Router state RequireAuth left, kept for the register link. */
  readonly linkState?: unknown;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onTotpChange: (value: string) => void;
  readonly onSubmit: (event: React.FormEvent) => void;
}

export function LoginView(props: LoginViewProps): React.JSX.Element {
  const intl = useIntl();
  const { showTotp, error } = props;

  return (
    <div>
      <AuthHeading
        title={<FormattedMessage id="screen.login.title" defaultMessage="Log in" />}
        subtitle={
          <FormattedMessage
            id="auth.login.subtitle"
            defaultMessage="Log in to your household budget."
          />
        }
      />
      <form onSubmit={props.onSubmit} style={AUTH_FORM_STYLE}>
        <Input
          id="login-email"
          type="email"
          label={intl.formatMessage({ id: 'screen.login.email.label', defaultMessage: 'Email' })}
          value={props.email}
          onChange={props.onEmailChange}
        />
        <Input
          id="login-password"
          type="password"
          label={intl.formatMessage({
            id: 'screen.login.password.label',
            defaultMessage: 'Password',
          })}
          value={props.password}
          onChange={props.onPasswordChange}
        />
        {showTotp && (
          <>
            <AuthStatus id="login-totp-hint">
              <FormattedMessage
                id="auth.login.totp.hint"
                defaultMessage="Two-factor authentication is on. Enter the 6-digit code from your authenticator app."
              />
            </AuthStatus>
            <CodeField
              id="login-totp"
              label={intl.formatMessage({
                id: 'screen.login.totp.label',
                defaultMessage: 'Authenticator code',
              })}
              value={props.totp}
              onChange={props.onTotpChange}
              invalid={error === 'invalidTotp'}
            />
          </>
        )}
        {error !== null && <AuthNotice message={<LoginErrorText error={error} />} />}
        <Button type="submit" loading={props.loading}>
          <FormattedMessage id="screen.login.submit" defaultMessage="Log in" />
        </Button>
      </form>
      <AuthLinks>
        <AuthLink to="/auth/magic-link">
          <FormattedMessage id="screen.login.forgotPassword" defaultMessage="Forgot password?" />
        </AuthLink>
        <AuthLink to="/register" state={props.linkState}>
          <FormattedMessage id="screen.login.createAccount" defaultMessage="Create account" />
        </AuthLink>
      </AuthLinks>
    </div>
  );
}

function LoginErrorText({ error }: { readonly error: LoginError }): React.JSX.Element {
  switch (error) {
    case 'invalidCredentials':
      return (
        <FormattedMessage
          id="screen.login.error.invalidCredentials"
          defaultMessage="Invalid email or password."
        />
      );
    case 'invalidTotp':
      return (
        <FormattedMessage
          id="screen.login.error.invalidTotp"
          defaultMessage="Invalid authenticator code."
        />
      );
    case 'tooManyAttempts':
      return (
        <FormattedMessage
          id="auth.error.tooManyAttempts"
          defaultMessage="Too many attempts. Please wait a few minutes and try again."
        />
      );
    case 'serverError':
      return (
        <FormattedMessage
          id="screen.login.error.serverError"
          defaultMessage="Something went wrong. Please try again."
        />
      );
  }
}
