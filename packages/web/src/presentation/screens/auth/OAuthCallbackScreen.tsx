import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';

export function OAuthCallbackScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const code = searchParams.get('code');
  const hasError = searchParams.get('error') !== null;

  useEffect(() => {
    if (code) {
      const timer = setTimeout(() => {
        navigate('/dashboard');
      }, 500);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [code, navigate]);

  if (hasError || !code) {
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
