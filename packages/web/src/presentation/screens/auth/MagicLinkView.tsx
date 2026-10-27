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

export type MagicLinkError = 'consumeFailed' | 'requestFailed' | 'invalidTotp' | 'tooManyAttempts';

/** request: ask for a link; sent: the link is on its way; consume: the emailed link was opened. */
export type MagicLinkStage = 'request' | 'sent' | 'consume';

export interface MagicLinkViewProps {
  readonly stage: MagicLinkStage;
  readonly email: string;
  readonly totp: string;
  readonly showTotp: boolean;
  readonly loading: boolean;
  readonly error: MagicLinkError | null;
  readonly onEmailChange: (value: string) => void;
  readonly onTotpChange: (value: string) => void;
  readonly onRequestSubmit: (event: React.FormEvent) => void;
  readonly onTotpSubmit: (event: React.FormEvent) => void;
}

export function MagicLinkView(props: MagicLinkViewProps): React.JSX.Element {
  return (
    <div>
      <AuthHeading
        title={
          <FormattedMessage id="screen.magicLink.title" defaultMessage="Sign in with email link" />
        }
        subtitle={
          props.stage === 'request' ? (
            <FormattedMessage
              id="auth.magicLink.subtitle"
              defaultMessage="We will email you a link that signs you in."
            />
          ) : undefined
        }
      />
      {props.stage === 'request' && <RequestForm {...props} />}
      {props.stage === 'sent' && <SentNotice />}
      {props.stage === 'consume' && <ConsumeBody {...props} />}
    </div>
  );
}

function RequestForm(props: MagicLinkViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <>
      <form onSubmit={props.onRequestSubmit} style={AUTH_FORM_STYLE}>
        <Input
          id="magic-link-email"
          type="email"
          label={intl.formatMessage({
            id: 'screen.magicLink.email.label',
            defaultMessage: 'Email',
          })}
          value={props.email}
          onChange={props.onEmailChange}
        />
        {props.error === 'requestFailed' && (
          <AuthNotice
            message={
              <FormattedMessage
                id="screen.magicLink.error.requestFailed"
                defaultMessage="Could not send the link. Please try again."
              />
            }
          />
        )}
        {props.error === 'tooManyAttempts' && <TooManyAttempts />}
        <Button type="submit" loading={props.loading}>
          <FormattedMessage id="screen.magicLink.submit" defaultMessage="Send sign-in link" />
        </Button>
      </form>
      <BackToLogin />
    </>
  );
}

function SentNotice(): React.JSX.Element {
  return (
    <>
      <AuthStatus>
        <FormattedMessage
          id="screen.magicLink.sent"
          defaultMessage="Check your email — we sent you a sign-in link."
        />
      </AuthStatus>
      <BackToLogin />
    </>
  );
}

function ConsumeBody(props: MagicLinkViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <div style={AUTH_FORM_STYLE}>
      {props.loading && (
        <AuthStatus>
          <FormattedMessage id="screen.magicLink.consuming" defaultMessage="Signing you in…" />
        </AuthStatus>
      )}
      {props.showTotp && (
        <form onSubmit={props.onTotpSubmit} style={AUTH_FORM_STYLE}>
          <CodeField
            id="magic-link-totp"
            label={intl.formatMessage({
              id: 'screen.login.totp.label',
              defaultMessage: 'Authenticator code',
            })}
            value={props.totp}
            onChange={props.onTotpChange}
            invalid={props.error === 'invalidTotp'}
          />
          {props.error === 'invalidTotp' && (
            <AuthNotice
              message={
                <FormattedMessage
                  id="screen.login.error.invalidTotp"
                  defaultMessage="Invalid authenticator code."
                />
              }
            />
          )}
          <Button type="submit" loading={props.loading}>
            <FormattedMessage id="screen.login.submit" defaultMessage="Log in" />
          </Button>
        </form>
      )}
      {props.error === 'tooManyAttempts' && <TooManyAttempts />}
      {props.error === 'consumeFailed' && (
        <>
          <AuthNotice
            message={
              <FormattedMessage
                id="screen.magicLink.error.consumeFailed"
                defaultMessage="This link is invalid or has expired. Please request a new one."
              />
            }
          />
          <AuthLinks>
            <AuthLink to="/auth/magic-link">
              <FormattedMessage
                id="auth.magicLink.requestNew"
                defaultMessage="Request a new link"
              />
            </AuthLink>
          </AuthLinks>
        </>
      )}
    </div>
  );
}

function TooManyAttempts(): React.JSX.Element {
  return (
    <AuthNotice
      message={
        <FormattedMessage
          id="auth.error.tooManyAttempts"
          defaultMessage="Too many attempts. Please wait a few minutes and try again."
        />
      }
    />
  );
}

function BackToLogin(): React.JSX.Element {
  return (
    <AuthLinks>
      <AuthLink to="/login">
        <FormattedMessage id="auth.magicLink.backToLogin" defaultMessage="Back to log in" />
      </AuthLink>
    </AuthLinks>
  );
}
