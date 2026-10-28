import React from 'react';
import { useIntl } from 'react-intl';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import {
  AuthHeading,
  AuthLayout,
  AuthLink,
  AuthLinks,
  AuthNotice,
  AuthStatus,
  CodeField,
} from './AuthParts.js';

export type LoginError =
  'required' | 'invalidCredentials' | 'invalidTotp' | 'tooManyAttempts' | 'serverError';

export interface LoginViewProps {
  readonly email: string;
  readonly password: string;
  readonly totp: string;
  /** The server asked for the authenticator code. */
  readonly showTotp: boolean;
  readonly loading: boolean;
  readonly error: LoginError | null;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onTotpChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onForgotPassword: () => void;
  readonly onCreateAccount: () => void;
}

export function LoginView(props: LoginViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <AuthLayout>
      <AuthHeading
        title={intl.formatMessage({ id: 'auth.login.title', defaultMessage: 'Log in' })}
        subtitle={intl.formatMessage({
          id: 'auth.login.subtitle',
          defaultMessage: 'Log in to your household budget.',
        })}
      />
      <Input
        label={intl.formatMessage({ id: 'auth.login.email', defaultMessage: 'Email' })}
        value={props.email}
        onChangeText={props.onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label={intl.formatMessage({ id: 'auth.login.password', defaultMessage: 'Password' })}
        value={props.password}
        onChangeText={props.onPasswordChange}
        secureTextEntry
      />
      {props.showTotp && (
        <>
          <AuthStatus>
            {intl.formatMessage({
              id: 'auth.login.totpHint',
              defaultMessage:
                'Two-factor authentication is on. Enter the 6-digit code from your authenticator app.',
            })}
          </AuthStatus>
          <CodeField
            label={intl.formatMessage({
              id: 'auth.login.totpLabel',
              defaultMessage: 'Authenticator code',
            })}
            value={props.totp}
            onChangeText={props.onTotpChange}
            invalid={props.error === 'invalidTotp'}
          />
        </>
      )}
      {props.error !== null && <AuthNotice message={loginErrorText(intl, props.error)} />}
      <Button loading={props.loading} onPress={props.onSubmit}>
        {intl.formatMessage({ id: 'auth.login.submit', defaultMessage: 'Log in' })}
      </Button>
      <AuthLinks>
        <AuthLink
          label={intl.formatMessage({
            id: 'auth.login.forgotPassword',
            defaultMessage: 'Forgot password?',
          })}
          onPress={props.onForgotPassword}
        />
        <AuthLink
          label={intl.formatMessage({
            id: 'auth.login.createAccount',
            defaultMessage: 'Create account',
          })}
          onPress={props.onCreateAccount}
        />
      </AuthLinks>
    </AuthLayout>
  );
}

function loginErrorText(intl: ReturnType<typeof useIntl>, error: LoginError): string {
  switch (error) {
    case 'required':
      return intl.formatMessage({
        id: 'auth.login.error.required',
        defaultMessage: 'Email and password are required.',
      });
    case 'invalidCredentials':
      return intl.formatMessage({
        id: 'auth.login.error.invalidCredentials',
        defaultMessage: 'Invalid email or password.',
      });
    case 'invalidTotp':
      return intl.formatMessage({
        id: 'auth.login.error.invalidTotp',
        defaultMessage: 'Invalid authenticator code.',
      });
    case 'tooManyAttempts':
      return intl.formatMessage({
        id: 'auth.error.tooManyAttempts',
        defaultMessage: 'Too many attempts. Please wait a few minutes and try again.',
      });
    case 'serverError':
      return intl.formatMessage({
        id: 'auth.login.error.serverError',
        defaultMessage: 'Something went wrong. Please try again.',
      });
  }
}
