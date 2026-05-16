import React from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';

interface StepInterestingCurrenciesProps {
  store: OnboardingStore;
}

const MAX_INTERESTING = 5;

const CURRENCY_OPTIONS: string[] = [
  'USD',
  'EUR',
  'GBP',
  'PLN',
  'UAH',
  'CHF',
  'CZK',
  'JPY',
  'CAD',
  'AUD',
];

export const StepInterestingCurrencies = observer(function StepInterestingCurrencies({
  store,
}: StepInterestingCurrenciesProps): React.JSX.Element {
  const selected = store.interestingCurrencies;
  const isMaxReached = selected.length >= MAX_INTERESTING;

  function handleToggle(code: string): void {
    if (selected.includes(code)) {
      store.setInterestingCurrencies(selected.filter((c) => c !== code));
    } else if (!isMaxReached) {
      store.setInterestingCurrencies([...selected, code]);
    }
  }

  const availableOptions = CURRENCY_OPTIONS.filter((c) => c !== store.baseCurrency);

  return (
    <div>
      <h2>
        <FormattedMessage
          id="onboarding.step.interestingCurrencies.title"
          defaultMessage="Track additional currencies"
        />
      </h2>
      <p>
        <FormattedMessage
          id="onboarding.step.interestingCurrencies.description"
          defaultMessage="Select up to {max} currencies to track alongside your base currency."
          values={{ max: MAX_INTERESTING }}
        />
      </p>
      {isMaxReached && (
        <p style={{ color: '#888', fontSize: '0.875rem' }}>
          <FormattedMessage
            id="onboarding.step.interestingCurrencies.maxHint"
            defaultMessage="Maximum {max} currencies selected."
            values={{ max: MAX_INTERESTING }}
          />
        </p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {availableOptions.map((code) => {
          const isChecked = selected.includes(code);
          const isDisabled = !isChecked && isMaxReached;
          return (
            <li key={code} style={{ marginBottom: '0.5rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => handleToggle(code)}
                />
                {code}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
