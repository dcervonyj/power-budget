import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';

interface StepCreatePlanProps {
  store: OnboardingStore;
}

export const StepCreatePlan = observer(function StepCreatePlan({
  store,
}: StepCreatePlanProps): React.JSX.Element {
  return (
    <div>
      <h2>
        <FormattedMessage
          id="onboarding.step.createPlan.title"
          defaultMessage="Create your first plan"
        />
      </h2>
      <p>
        <FormattedMessage
          id="onboarding.step.createPlan.description"
          defaultMessage="A plan lets you set income and expense targets for a period (weekly, monthly, or custom). Map your transactions to planned items to track your actuals."
        />
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <Link to="/plans" style={{ textDecoration: 'none' }}>
          <button type="button" style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
            <FormattedMessage
              id="onboarding.step.createPlan.createNow"
              defaultMessage="Create plan"
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
