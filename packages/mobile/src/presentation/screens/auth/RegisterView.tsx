import React from 'react';
import { useIntl } from 'react-intl';
import type { SelectOption } from '@power-budget/shared-app';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import {
  AuthHeading,
  AuthLayout,
  AuthLink,
  AuthLinks,
  AuthNotice,
  AuthStatus,
} from './AuthParts.js';

export type RegisterLocale = 'en' | 'uk' | 'ru' | 'pl';

export type RegisterError = 'required' | 'emailInUse' | 'tooManyAttempts' | 'serverError';

export interface RegisterViewProps {
  readonly email: string;
  readonly password: string;
  readonly locale: RegisterLocale;
  readonly loading: boolean;
  readonly error: RegisterError | null;
  /** The confirmation link was sent: replaces the form. */
  readonly sent: boolean;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onLocaleChange: (value: RegisterLocale) => void;
  readonly onSubmit: () => void;
  readonly onBackToLogin: () => void;
}

const LOCALE_OPTIONS: ReadonlyArray<SelectOption<RegisterLocale>> = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'pl', label: 'Polski' },
];

export function RegisterView(props: RegisterViewProps): React.JSX.Element {
  const intl = useIntl();

  if (props.sent) {
    return (
      <AuthLayout>
        <AuthHeading
          title={intl.formatMessage({
            id: 'auth.register.sent.title',
            defaultMessage: 'Check your email',
          })}
        />
        <AuthStatus>
          {intl.formatMessage(
            {
              id: 'auth.register.sent.body',
              defaultMessage: 'We sent a confirmation link to {email}.',
            },
            { email: props.email },
          )}
        </AuthStatus>
        <Button variant="secondary" onPress={props.onBackToLogin}>
          {intl.formatMessage({ id: 'auth.backToLogin', defaultMessage: 'Back to log in' })}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title={intl.formatMessage({ id: 'auth.register.title', defaultMessage: 'Create account' })}
        subtitle={intl.formatMessage({
          id: 'auth.register.subtitle',
          defaultMessage: 'Start planning your household budget.',
        })}
      />
      <Input
        label={intl.formatMessage({ id: 'auth.register.email', defaultMessage: 'Email' })}
        value={props.email}
        onChangeText={props.onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label={intl.formatMessage({ id: 'auth.register.password', defaultMessage: 'Password' })}
        value={props.password}
        onChangeText={props.onPasswordChange}
        secureTextEntry
      />
      <Select<RegisterLocale>
        label={intl.formatMessage({ id: 'auth.register.language', defaultMessage: 'Language' })}
        options={LOCALE_OPTIONS}
        value={props.locale}
        onChange={props.onLocaleChange}
      />
      {props.error !== null && <AuthNotice message={registerErrorText(intl, props.error)} />}
      <Button loading={props.loading} onPress={props.onSubmit}>
        {intl.formatMessage({ id: 'auth.register.submit', defaultMessage: 'Create account' })}
      </Button>
      <AuthLinks>
        <AuthLink
          label={intl.formatMessage({
            id: 'auth.register.loginLink',
            defaultMessage: 'Already have an account? Log in',
          })}
          onPress={props.onBackToLogin}
        />
      </AuthLinks>
    </AuthLayout>
  );
}

function registerErrorText(intl: ReturnType<typeof useIntl>, error: RegisterError): string {
  switch (error) {
    case 'required':
      return intl.formatMessage({
        id: 'auth.login.error.required',
        defaultMessage: 'Email and password are required.',
      });
    case 'emailInUse':
      return intl.formatMessage({
        id: 'auth.register.error.emailInUse',
        defaultMessage: 'An account with this email already exists.',
      });
    case 'tooManyAttempts':
      return intl.formatMessage({
        id: 'auth.error.tooManyAttempts',
        defaultMessage: 'Too many attempts. Please wait a few minutes and try again.',
      });
    case 'serverError':
      return intl.formatMessage({
        id: 'auth.register.error.serverError',
        defaultMessage: 'Something went wrong. Please try again.',
      });
  }
}
