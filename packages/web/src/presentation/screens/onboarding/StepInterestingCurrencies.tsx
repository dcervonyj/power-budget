import React from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import {
  INTERESTING_CURRENCY_OPTIONS,
  MAX_INTERESTING_CURRENCIES,
} from '../../../application/onboarding/OnboardingOptions.js';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import '../../glass/controls/controls.css';
import {
  STEP_STYLE,
  STEP_TEXT_STYLE,
  STEP_TITLE_STYLE,
  chipToggleStyle,
} from './onboardingStyles.js';

interface StepInterestingCurrenciesProps {
  store: OnboardingStore;
}

const CHIPS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

export const StepInterestingCurrencies = observer(function StepInterestingCurrencies({
  store,
}: StepInterestingCurrenciesProps): React.JSX.Element {
  const selected = store.interestingCurrencies;
  const isMaxReached = selected.length >= MAX_INTERESTING_CURRENCIES;
  const options = INTERESTING_CURRENCY_OPTIONS.filter((code) => code !== store.baseCurrency);

  return (
    <div style={STEP_STYLE}>
      <h1 style={STEP_TITLE_STYLE}>
        <FormattedMessage
          id="onboarding.step.interestingCurrencies.title"
          defaultMessage="Track additional currencies"
        />
      </h1>
      <p style={STEP_TEXT_STYLE}>
        <FormattedMessage
          id="onboarding.step.interestingCurrencies.description"
          defaultMessage="Select up to {max} currencies to track alongside your base currency."
          values={{ max: MAX_INTERESTING_CURRENCIES }}
        />
      </p>
      {isMaxReached && (
        <p role="status" style={STEP_TEXT_STYLE}>
          <FormattedMessage
            id="onboarding.step.interestingCurrencies.maxHint"
            defaultMessage="Maximum {max} currencies selected."
            values={{ max: MAX_INTERESTING_CURRENCIES }}
          />
        </p>
      )}
      <ul style={CHIPS_STYLE}>
        {options.map((code) => {
          const isChecked = selected.includes(code);

          return (
            <li key={code}>
              <button
                type="button"
                className="pbg-ctl"
                aria-pressed={isChecked}
                disabled={!isChecked && isMaxReached}
                style={chipToggleStyle(isChecked)}
                onClick={() => {
                  store.toggleInterestingCurrency(code);
                }}
              >
                {code}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
