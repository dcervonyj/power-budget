import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { readApiError } from '@power-budget/shared-app';
import { apiClient, tokenStore } from '../../../AppProviders.js';
import { Button, Input } from '../../components/index.js';

interface ConsumeResponse {
  accessToken: string;
  refreshToken: string;
}

type MagicLinkError = 'consumeFailed' | 'requestFailed' | 'invalidTotp' | 'tooManyAttempts' | null;

/** What a failed consume means (CLN-004): 403 requires_totp keeps the link valid. */
function classifyConsumeError(err: unknown): 'requiresTotp' | Exclude<MagicLinkError, null> {
  switch (readApiError(err).code) {
    case 'requires_totp':
      return 'requiresTotp';
    case 'totp_invalid':
      return 'invalidTotp';
    case 'too_many_requests':
      return 'tooManyAttempts';
    default:
      return 'consumeFailed';
  }
}

function classifyRequestError(err: unknown): Exclude<MagicLinkError, null> {
  return readApiError(err).code === 'too_many_requests' ? 'tooManyAttempts' : 'requestFailed';
}

export function MagicLinkScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [totp, setTotp] = useState('');
  const [showTotp, setShowTotp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<MagicLinkError>(null);
  const consumedOnMount = useRef(false);

  const consumeToken = useCallback(
    async (linkToken: string, code: string): Promise<void> => {
      setIsLoading(true);
      setMagicLinkError(null);
      try {
        const body = code ? { token: linkToken, totp: code } : { token: linkToken };
        const res = await apiClient.post<ConsumeResponse>('/auth/magic-link/consume', body);
        await tokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
        navigate('/dashboard');
      } catch (err) {
        const outcome = classifyConsumeError(err);
        if (outcome === 'requiresTotp') {
          setShowTotp(true);
        } else {
          setMagicLinkError(outcome);
        }
        setIsLoading(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!token || consumedOnMount.current) {
      return;
    }
    consumedOnMount.current = true;
    void consumeToken(token, '');
  }, [token, consumeToken]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setMagicLinkError(null);
    try {
      await apiClient.post('/auth/magic-link/request', { email });
      setSent(true);
    } catch (err) {
      setMagicLinkError(classifyRequestError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (token) {
      void consumeToken(token, totp);
    }
  };

  const tooManyAttempts = magicLinkError === 'tooManyAttempts' && (
    <p role="alert">
      <FormattedMessage
        id="auth.error.tooManyAttempts"
        defaultMessage="Too many attempts. Please wait a few minutes and try again."
      />
    </p>
  );

  if (token) {
    return (
      <div>
        {isLoading && (
          <p>
            <FormattedMessage id="screen.magicLink.consuming" defaultMessage="Signing you in…" />
          </p>
        )}
        {showTotp && (
          <form onSubmit={handleTotpSubmit}>
            <Input
              id="magic-link-totp"
              type="text"
              label={intl.formatMessage({
                id: 'screen.login.totp.label',
                defaultMessage: 'Authenticator code',
              })}
              value={totp}
              onChange={setTotp}
            />
            {magicLinkError === 'invalidTotp' && (
              <p>
                <FormattedMessage
                  id="screen.login.error.invalidTotp"
                  defaultMessage="Invalid authenticator code."
                />
              </p>
            )}
            <Button type="submit" loading={isLoading}>
              <FormattedMessage id="screen.login.submit" defaultMessage="Log in" />
            </Button>
          </form>
        )}
        {tooManyAttempts}
        {magicLinkError === 'consumeFailed' && (
          <p>
            <FormattedMessage
              id="screen.magicLink.error.consumeFailed"
              defaultMessage="This link is invalid or has expired. Please request a new one."
            />
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>
        <FormattedMessage id="screen.magicLink.title" defaultMessage="Sign in with email link" />
      </h1>
      {sent ? (
        <p>
          <FormattedMessage
            id="screen.magicLink.sent"
            defaultMessage="Check your email — we sent you a sign-in link."
          />
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <Input
            id="magic-link-email"
            type="email"
            label={intl.formatMessage({
              id: 'screen.magicLink.email.label',
              defaultMessage: 'Email',
            })}
            value={email}
            onChange={setEmail}
          />
          {magicLinkError === 'requestFailed' && (
            <p>
              <FormattedMessage
                id="screen.magicLink.error.requestFailed"
                defaultMessage="Could not send the link. Please try again."
              />
            </p>
          )}
          {tooManyAttempts}
          <Button type="submit" loading={isLoading}>
            <FormattedMessage id="screen.magicLink.submit" defaultMessage="Send sign-in link" />
          </Button>
        </form>
      )}
    </div>
  );
}
