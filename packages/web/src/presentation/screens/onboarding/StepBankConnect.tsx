import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';

interface StepBankConnectProps {
  store: OnboardingStore;
}

export const StepBankConnect = observer(function StepBankConnect({
  store,
}: StepBankConnectProps): React.JSX.Element {
  return (
    <div>
      <h2>
        <FormattedMessage
          id="onboarding.step.bankConnect.title"
          defaultMessage="Connect your bank"
        />
      </h2>
      <p>
        <FormattedMessage
          id="onboarding.step.bankConnect.description"
          defaultMessage="Link your bank accounts to automatically import transactions. We support GoCardless (PSD2) and Wise."
        />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <Link to="/bank-connections" style={{ textDecoration: 'none' }}>
          <button type="button" style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
            <FormattedMessage
              id="onboarding.step.bankConnect.connectNow"
              defaultMessage="Connect now"
            />
          </button>
        </Link>
        <button
          type="button"
          onClick={() => store.skip()}
          style={{
            padding: '0.5rem 1.5rem',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: '#666',
            textDecoration: 'underline',
          }}
        >
          <FormattedMessage id="onboarding.button.skip" defaultMessage="Skip for now" />
        </button>
      </div>
    </div>
  );
});
