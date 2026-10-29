import React from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { SupportedLocale } from '@power-budget/core';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import { Button } from '../../components/Button.js';
import { STEP_STYLE, ACTIONS_STYLE } from './onboardingStyles.js';
import { StepBankConnect } from './StepBankConnect.js';
import { StepCreatePlan } from './StepCreatePlan.js';
import { StepCurrency } from './StepCurrency.js';
import { StepIndicator } from './StepIndicator.js';
import { StepInterestingCurrencies } from './StepInterestingCurrencies.js';
import { StepLanguage } from './StepLanguage.js';

export interface OnboardingViewProps {
  readonly store: OnboardingStore;
  readonly onLocaleChange: (locale: SupportedLocale) => void;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly onSkip: () => void;
  /** The bank or plan link was followed: the wizard is left open behind it. */
  readonly onLeave?: () => void;
  /** Saving the choices to the profile failed; the wizard stays open to try again. */
  readonly saveFailed?: boolean;
}

function noop(): void {}

const FRAME_STYLE: React.CSSProperties = {
  ...STEP_STYLE,
  gap: 'var(--pb-glass-space-xl)',
};

/** The wizard frame (props only): step rod, the current step and the back / next row. */
export const OnboardingView = observer(function OnboardingView({
  store,
  onLocaleChange,
  onBack,
  onNext,
  onSkip,
  onLeave = noop,
  saveFailed = false,
}: OnboardingViewProps): React.JSX.Element {
  const isSkippableStep =
    store.currentStep === 'bank-connect' || store.currentStep === 'create-plan';

  return (
    <div style={FRAME_STYLE}>
      <StepIndicator index={store.currentStepIndex} total={store.steps.length} />
      {renderStep(store, onLocaleChange, onSkip, onLeave)}
      {saveFailed && (
        <p role="alert">
          <FormattedMessage
            id="onboarding.saveError"
            defaultMessage="We could not save your choices. Try again."
          />
        </p>
      )}
      <div style={ACTIONS_STYLE}>
        <Button variant="secondary" disabled={store.isFirstStep} onClick={onBack}>
          <FormattedMessage id="onboarding.button.back" defaultMessage="Back" />
        </Button>
        {!isSkippableStep && (
          <Button variant="primary" onClick={onNext}>
            {store.isLastStep ? (
              <FormattedMessage id="onboarding.button.finish" defaultMessage="Finish" />
            ) : (
              <FormattedMessage id="onboarding.button.next" defaultMessage="Next" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
});

function renderStep(
  store: OnboardingStore,
  onLocaleChange: (locale: SupportedLocale) => void,
  onSkip: () => void,
  onLeave: () => void,
): React.JSX.Element {
  switch (store.currentStep) {
    case 'language':
      return <StepLanguage store={store} onLocaleChange={onLocaleChange} />;
    case 'currency':
      return <StepCurrency store={store} />;
    case 'interesting-currencies':
      return <StepInterestingCurrencies store={store} />;
    case 'bank-connect':
      return <StepBankConnect onSkip={onSkip} onLeave={onLeave} />;
    case 'create-plan':
      return <StepCreatePlan onSkip={onSkip} onLeave={onLeave} />;
  }
}
