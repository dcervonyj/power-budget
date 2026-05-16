import React, { useEffect, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, tokenStore } from '../../../AppProviders.js';

interface GoogleCallbackResponse {
  accessToken: string;
  refreshToken: string;
}

export function OAuthCallbackScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didRun = useRef(false);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const hasError = searchParams.get('error') !== null;

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (hasError || !code || !state) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    const storedNonce = sessionStorage.getItem('oauth_nonce');
    if (state !== storedNonce) {
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    const completeOAuth = async (): Promise<void> => {
      try {
        const res = await apiClient.post<GoogleCallbackResponse>('/auth/oauth/google/callback', {
          code,
          state,
        });
        const data = res.data;
        await tokenStore.setTokens(data.accessToken, data.refreshToken);
        sessionStorage.removeItem('oauth_nonce');
        navigate('/dashboard', { replace: true });
      } catch {
        navigate('/login?error=oauth_failed', { replace: true });
      }
    };
    void completeOAuth();
  }, [code, state, hasError, navigate]);

  if (hasError || !code || !state) {
    return (
      <div>
        <p>
          <FormattedMessage
            id="screen.oauthCallback.error"
            defaultMessage="Authentication failed. Please try again."
          />
        </p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <FormattedMessage id="screen.oauthCallback.loading" defaultMessage="Completing login…" />
      </p>
    </div>
  );
}
