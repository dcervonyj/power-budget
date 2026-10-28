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
} from './AuthParts.js';

export type MagicLinkError = 'required' | 'requestFailed' | 'tooManyAttempts';

export interface MagicLinkViewProps {
  /** The link is on its way: replaces the form. */
  readonly sent: boolean;
  readonly email: string;
  readonly loading: boolean;
  readonly error: MagicLinkError | null;
  readonly onEmailChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onBackToLogin: () => void;
}

export function MagicLinkView(props: MagicLinkViewProps): React.JSX.Element {
  const intl = useIntl();
  const backLabel = intl.formatMessage({
    id: 'auth.backToLogin',
    defaultMessage: 'Back to log in',
  });

  if (props.sent) {
    return (
      <AuthLayout>
        <AuthHeading
          title={intl.formatMessage({
            id: 'auth.magicLink.sent.title',
            defaultMessage: 'Check your email',
          })}
        />
        <AuthStatus>
          {intl.formatMessage(
            {
              id: 'auth.magicLink.sent.body',
              defaultMessage: 'We sent a sign-in link to {email}.',
            },
            { email: props.email },
          )}
        </AuthStatus>
        <Button variant="secondary" onPress={props.onBackToLogin}>
          {backLabel}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title={intl.formatMessage({
          id: 'auth.magicLink.title',
          defaultMessage: 'Sign in with email link',
        })}
        subtitle={intl.formatMessage({
          id: 'auth.magicLink.subtitle',
          defaultMessage: 'We will email you a link that signs you in.',
        })}
      />
      <Input
        label={intl.formatMessage({ id: 'auth.magicLink.email', defaultMessage: 'Email' })}
        value={props.email}
        onChangeText={props.onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {props.error !== null && <AuthNotice message={magicLinkErrorText(intl, props.error)} />}
      <Button loading={props.loading} onPress={props.onSubmit}>
        {intl.formatMessage({ id: 'auth.magicLink.submit', defaultMessage: 'Send sign-in link' })}
      </Button>
      <AuthLinks>
        <AuthLink label={backLabel} onPress={props.onBackToLogin} />
      </AuthLinks>
    </AuthLayout>
  );
}

function magicLinkErrorText(intl: ReturnType<typeof useIntl>, error: MagicLinkError): string {
  switch (error) {
    case 'required':
      return intl.formatMessage({
        id: 'auth.magicLink.error.required',
        defaultMessage: 'Email is required.',
      });
    case 'requestFailed':
      return intl.formatMessage({
        id: 'auth.magicLink.error.requestFailed',
        defaultMessage: 'Could not send the link. Please try again.',
      });
    case 'tooManyAttempts':
      return intl.formatMessage({
        id: 'auth.error.tooManyAttempts',
        defaultMessage: 'Too many attempts. Please wait a few minutes and try again.',
      });
  }
}
