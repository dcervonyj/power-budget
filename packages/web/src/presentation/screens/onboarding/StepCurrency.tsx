import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';

interface StepCurrencyProps {
  store: OnboardingStore;
}

const CURRENCY_OPTIONS: string[] = ['USD', 'EUR', 'GBP', 'PLN', 'UAH', 'CHF', 'CZK'];

export const StepCurrency = observer(function StepCurrency({
  store,
}: StepCurrencyProps): React.JSX.Element {
  const intl = useIntl();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    store.setBaseCurrency(e.target.value);
  }

  return (
    <div>
      <h2>
        <FormattedMessage
          id="onboarding.step.currency.title"
          defaultMessage="Set your base currency"
        />
      </h2>
      <p>
        <FormattedMessage
          id="onboarding.step.currency.description"
          defaultMessage="All amounts will be converted to this currency by default."
        />
      </p>
      <label htmlFor="base-currency-select">
        <FormattedMessage id="onboarding.step.currency.label" defaultMessage="Base currency" />
      </label>
      <select
        id="base-currency-select"
        value={store.baseCurrency}
        onChange={handleChange}
        aria-label={intl.formatMessage({
          id: 'onboarding.step.currency.label',
          defaultMessage: 'Base currency',
        })}
        style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', minWidth: '200px' }}
      >
        {CURRENCY_OPTIONS.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </div>
  );
});
