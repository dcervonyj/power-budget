import React, { useEffect, useRef } from 'react';
import { FormattedMessage } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../../AppProviders.js';

export function BankConsentCallbackScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const didRun = useRef(false);

  const ref = searchParams.get('ref');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (errorParam !== null || !ref) {
      navigate('/bank-connections?error=consent_failed', { replace: true });
      return;
    }

    const completeConsent = async (): Promise<void> => {
      try {
        await apiClient.post('/bank-connections/consent-callback', { ref });
        navigate('/bank-connections?connected=1', { replace: true });
      } catch {
        navigate('/bank-connections?error=consent_failed', { replace: true });
      }
    };
    void completeConsent();
  }, [ref, errorParam, navigate]);

  if (errorParam !== null || !ref) {
    return (
      <div>
        <p>
          <FormattedMessage
            id="screen.bankConsentCallback.error"
            defaultMessage="Bank consent failed. Please try again."
          />
        </p>
      </div>
    );
  }

  return (
    <div>
      <p>
        <FormattedMessage
          id="screen.bankConsentCallback.loading"
          defaultMessage="Completing bank connection…"
        />
      </p>
    </div>
  );
}
