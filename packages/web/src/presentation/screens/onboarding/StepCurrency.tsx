import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { SelectOption } from '@power-budget/shared-app';
import { BASE_CURRENCY_OPTIONS } from '../../../application/onboarding/OnboardingOptions.js';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import { Select } from '../../components/Select.js';
import { STEP_STYLE, STEP_TEXT_STYLE, STEP_TITLE_STYLE } from './onboardingStyles.js';

interface StepCurrencyProps {
  store: OnboardingStore;
}

const OPTIONS: ReadonlyArray<SelectOption<string>> = BASE_CURRENCY_OPTIONS.map(toOption);

function toOption(code: string): SelectOption<string> {
  return { value: code, label: code };
}

export const StepCurrency = observer(function StepCurrency({
  store,
}: StepCurrencyProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <div style={STEP_STYLE}>
      <h1 style={STEP_TITLE_STYLE}>
        <FormattedMessage
          id="onboarding.step.currency.title"
          defaultMessage="Set your base currency"
        />
      </h1>
      <p style={STEP_TEXT_STYLE}>
        <FormattedMessage
          id="onboarding.step.currency.description"
          defaultMessage="All amounts will be converted to this currency by default."
        />
      </p>
      <Select<string>
        id="base-currency-select"
        label={intl.formatMessage({
          id: 'onboarding.step.currency.label',
          defaultMessage: 'Base currency',
        })}
        options={OPTIONS}
        value={store.baseCurrency}
        onChange={store.setBaseCurrency.bind(store)}
      />
    </div>
  );
});
