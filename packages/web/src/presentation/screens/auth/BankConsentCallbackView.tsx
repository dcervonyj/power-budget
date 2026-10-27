import React from 'react';
import { FormattedMessage } from 'react-intl';
import { AuthHeading, AuthNotice, AuthStatus } from './AuthParts.js';

export interface BankConsentCallbackViewProps {
  readonly failed: boolean;
}

export function BankConsentCallbackView({
  failed,
}: BankConsentCallbackViewProps): React.JSX.Element {
  return (
    <div>
      <AuthHeading
        title={<FormattedMessage id="auth.bankConsent.title" defaultMessage="Bank connection" />}
      />
      {failed ? (
        <AuthNotice
          message={
            <FormattedMessage
              id="screen.bankConsentCallback.error"
              defaultMessage="Bank consent failed. Please try again."
            />
          }
        />
      ) : (
        <AuthStatus>
          <FormattedMessage
            id="screen.bankConsentCallback.loading"
            defaultMessage="Completing bank connection…"
          />
        </AuthStatus>
      )}
    </div>
  );
}
