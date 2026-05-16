import React, { useContext } from 'react';
import { FormattedMessage } from 'react-intl';
import { useLocalObservable, observer } from 'mobx-react-lite';
import { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import { LocaleContext } from '../../../AppProviders.js';
import type { SupportedLocale } from '../../../AppProviders.js';
import { StepLanguage } from './StepLanguage.js';
import { StepCurrency } from './StepCurrency.js';
import { StepInterestingCurrencies } from './StepInterestingCurrencies.js';
import { StepBankConnect } from './StepBankConnect.js';
import { StepCreatePlan } from './StepCreatePlan.js';
import type { OnboardingStep } from '../../../application/onboarding/OnboardingStore.js';

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

function isSupportedLocale(lang: string): lang is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard = observer(function OnboardingWizard({
  onComplete,
}: OnboardingWizardProps): React.JSX.Element {
  const { setLocale } = useContext(LocaleContext);

  const store = useLocalObservable(
    () =>
      new OnboardingStore() as OnboardingStore & {
        steps: OnboardingStep[];
        currentStepIndex: number;
        isLastStep: boolean;
        isFirstStep: boolean;
      },
  );

  const totalSteps = store.steps.length;
  const currentIndex = store.currentStepIndex;

  function handleLocaleChange(locale: SupportedLocale): void {
    setLocale(locale);
  }

  function handleNext(): void {
    if (store.isLastStep) {
      persistOnboardingPrefs();
      onComplete();
    } else {
      store.next();
    }
  }

  function handleBack(): void {
    store.back();
  }

  function persistOnboardingPrefs(): void {
    localStorage.setItem('pb_base_currency', store.baseCurrency);
    localStorage.setItem('pb_interesting_currencies', JSON.stringify(store.interestingCurrencies));
    if (isSupportedLocale(store.selectedLanguage)) {
      localStorage.setItem('pb_locale', store.selectedLanguage);
    }
  }

  function renderStep(): React.JSX.Element {
    switch (store.currentStep) {
      case 'language':
        return <StepLanguage store={store} onLocaleChange={handleLocaleChange} />;
      case 'currency':
        return <StepCurrency store={store} />;
      case 'interesting-currencies':
        return <StepInterestingCurrencies store={store} />;
      case 'bank-connect':
        return <StepBankConnect store={store} />;
      case 'create-plan':
        return <StepCreatePlan store={store} />;
    }
  }

  const isSkippableStep =
    store.currentStep === 'bank-connect' || store.currentStep === 'create-plan';

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '2rem',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Progress indicator */}
      <div
        style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem' }}
        aria-label={undefined}
      >
        {store.steps.map((step, index) => (
          <div
            key={step}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: index <= currentIndex ? '#333' : '#ccc',
              transition: 'background 0.2s',
            }}
            aria-hidden="true"
          />
        ))}
      </div>

      <p
        style={{ textAlign: 'center', color: '#666', fontSize: '0.875rem', marginBottom: '1.5rem' }}
      >
        <FormattedMessage
          id="onboarding.progress"
          defaultMessage="Step {current} of {total}"
          values={{ current: currentIndex + 1, total: totalSteps }}
        />
      </p>

      {/* Step content */}
      <div style={{ marginBottom: '2rem' }}>{renderStep()}</div>

      {/* Navigation buttons */}
      {!isSkippableStep && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={store.isFirstStep}
            style={{
              padding: '0.5rem 1.5rem',
              cursor: store.isFirstStep ? 'not-allowed' : 'pointer',
              opacity: store.isFirstStep ? 0.4 : 1,
            }}
          >
            <FormattedMessage id="onboarding.button.back" defaultMessage="Back" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {store.isLastStep ? (
              <FormattedMessage id="onboarding.button.finish" defaultMessage="Finish" />
            ) : (
              <FormattedMessage id="onboarding.button.next" defaultMessage="Next" />
            )}
          </button>
        </div>
      )}
    </div>
  );
});
