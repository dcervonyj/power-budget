import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, tokenStore } from '../../../AppProviders.js';
import { Button, Input } from '../../components/index.js';

interface ConsumeResponse {
  accessToken: string;
  refreshToken: string;
}

type MagicLinkError = 'consumeFailed' | 'requestFailed' | null;

export function MagicLinkScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token');

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<MagicLinkError>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setIsLoading(true);
    setMagicLinkError(null);

    const consumeToken = async (): Promise<void> => {
      try {
        const res = await apiClient.post<ConsumeResponse>('/auth/magic-link/consume', { token });
        if (cancelled) return;
        await tokenStore.setTokens(res.data.accessToken, res.data.refreshToken);
        navigate('/dashboard');
      } catch {
        if (cancelled) return;
        setMagicLinkError('consumeFailed');
        setIsLoading(false);
      }
    };

    void consumeToken();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setMagicLinkError(null);
    try {
      await apiClient.post('/auth/magic-link/request', { email });
      setSent(true);
    } catch {
      setMagicLinkError('requestFailed');
    } finally {
      setIsLoading(false);
    }
  };

  if (token) {
    return (
      <div>
        {isLoading && (
          <p>
            <FormattedMessage id="screen.magicLink.consuming" defaultMessage="Signing you in…" />
          </p>
        )}
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
          <Button type="submit" loading={isLoading}>
            <FormattedMessage id="screen.magicLink.submit" defaultMessage="Send sign-in link" />
          </Button>
        </form>
      )}
    </div>
  );
}
