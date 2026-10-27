import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button, Input } from '../../components/index.js';
import { AUTH_FORM_STYLE, AuthHeading, AuthLink, AuthLinks, AuthNotice } from './AuthParts.js';

export type RegisterError = 'emailInUse' | 'serverError';

export interface RegisterViewProps {
  readonly email: string;
  readonly password: string;
  readonly loading: boolean;
  readonly error: RegisterError | null;
  readonly linkState?: unknown;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: (event: React.FormEvent) => void;
}

export function RegisterView(props: RegisterViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <div>
      <AuthHeading
        title={<FormattedMessage id="screen.register.title" defaultMessage="Create account" />}
        subtitle={
          <FormattedMessage
            id="auth.register.subtitle"
            defaultMessage="Start planning your household budget."
          />
        }
      />
      <form onSubmit={props.onSubmit} style={AUTH_FORM_STYLE}>
        <Input
          id="register-email"
          type="email"
          label={intl.formatMessage({
            id: 'screen.register.email.label',
            defaultMessage: 'Email',
          })}
          value={props.email}
          onChange={props.onEmailChange}
        />
        <Input
          id="register-password"
          type="password"
          label={intl.formatMessage({
            id: 'screen.register.password.label',
            defaultMessage: 'Password',
          })}
          value={props.password}
          onChange={props.onPasswordChange}
        />
        {props.error === 'emailInUse' && (
          <AuthNotice
            message={
              <FormattedMessage
                id="screen.register.error.emailInUse"
                defaultMessage="An account with this email already exists."
              />
            }
          />
        )}
        {props.error === 'serverError' && (
          <AuthNotice
            message={
              <FormattedMessage
                id="screen.register.error.serverError"
                defaultMessage="Something went wrong. Please try again."
              />
            }
          />
        )}
        <Button type="submit" loading={props.loading}>
          <FormattedMessage id="screen.register.submit" defaultMessage="Create account" />
        </Button>
      </form>
      <AuthLinks>
        <AuthLink to="/login" state={props.linkState}>
          <FormattedMessage
            id="screen.register.loginLink"
            defaultMessage="Already have an account? Log in"
          />
        </AuthLink>
      </AuthLinks>
    </div>
  );
}
