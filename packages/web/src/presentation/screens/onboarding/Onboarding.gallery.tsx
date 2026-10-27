import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  OnboardingStore,
  type OnboardingStep,
} from '../../../application/onboarding/OnboardingStore.js';
import { AuthLayoutView } from '../../shell/AuthLayoutView.js';
import { LocaleSelect } from '../../shell/LocaleSelect.js';
import { OnboardingView } from './OnboardingView.js';

/** Cancels the gallery page padding, so the frame fills the viewport as in the app. */
const FULL_BLEED: React.CSSProperties = { margin: 'calc(-1 * var(--pb-glass-space-3xl))' };

function noop(): void {
  // Gallery fixtures do not react to input.
}

function storeAt(
  step: OnboardingStep,
  setup: (store: OnboardingStore) => void = noop,
): OnboardingStore {
  const store = new OnboardingStore();
  store.setLanguage('en');
  store.setBaseCurrency('PLN');
  setup(store);
  store.goTo(step);

  return store;
}

function Step({ store }: { store: OnboardingStore }): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={FULL_BLEED}>
        <AuthLayoutView
          language={<LocaleSelect id="onboarding-locale" locale="en" onChange={noop} />}
        >
          <OnboardingView
            store={store}
            onLocaleChange={noop}
            onBack={noop}
            onNext={noop}
            onSkip={noop}
          />
        </AuthLayoutView>
      </div>
    </MemoryRouter>
  );
}

function pickCurrencies(codes: readonly string[]): (store: OnboardingStore) => void {
  return (store) => {
    codes.forEach((code) => {
      store.toggleInterestingCurrency(code);
    });
  };
}

/** Step 1 of 5: the language rows, English chosen. */
export function StepLanguage(): React.JSX.Element {
  return <Step store={storeAt('language')} />;
}

/** Step 2 of 5: base currency PLN (D7 spec sample household). */
export function StepCurrency(): React.JSX.Element {
  return <Step store={storeAt('currency')} />;
}

/** Step 3 of 5: two tracked currencies chosen. */
export function StepInterestingCurrencies(): React.JSX.Element {
  return <Step store={storeAt('interesting-currencies', pickCurrencies(['EUR', 'USD']))} />;
}

/** Step 3 of 5 at the maximum: the rest of the chips are disabled and the hint shows. */
export function StepInterestingCurrenciesMax(): React.JSX.Element {
  return (
    <Step
      store={storeAt('interesting-currencies', pickCurrencies(['EUR', 'USD', 'GBP', 'CHF', 'CZK']))}
    />
  );
}

/** Step 4 of 5: connect a bank or skip. */
export function StepBankConnect(): React.JSX.Element {
  return <Step store={storeAt('bank-connect')} />;
}

/** Step 5 of 5: full rod, create the first plan or skip. */
export function StepCreatePlan(): React.JSX.Element {
  return <Step store={storeAt('create-plan')} />;
}
