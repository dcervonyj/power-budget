import React, { useContext, useState } from 'react';
import { observer, useLocalObservable } from 'mobx-react-lite';
import { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import { persistOnboardingPrefs } from '../../../application/onboarding/OnboardingPrefs.js';
import { onboardingService } from '../../../composition.js';
import { LocaleContext } from '../../../AppProviders.js';
import { OnboardingView } from './OnboardingView.js';

interface OnboardingWizardProps {
  onComplete: () => void;
}

/** Container: owns the store, applies the language and saves the choices when the wizard ends. */
export const OnboardingWizard = observer(function OnboardingWizard({
  onComplete,
}: OnboardingWizardProps): React.JSX.Element {
  const { setLocale } = useContext(LocaleContext);
  const store = useLocalObservable(() => new OnboardingStore());
  const [saveFailed, setSaveFailed] = useState(false);

  async function save(): Promise<void> {
    persistOnboardingPrefs(localStorage, {
      baseCurrency: store.baseCurrency,
      interestingCurrencies: store.interestingCurrencies,
      language: store.selectedLanguage,
    });
    setSaveFailed(false);
    try {
      await onboardingService.complete({
        language: store.selectedLanguage,
        baseCurrency: store.baseCurrency,
        interestingCurrencies: store.interestingCurrencies,
      });
    } catch {
      setSaveFailed(true);

      return;
    }
    onComplete();
  }

  function finish(): void {
    void save();
  }

  function handleNext(): void {
    if (store.isLastStep) {
      finish();
    } else {
      store.next();
    }
  }

  function handleSkip(): void {
    const wasLastStep = store.isLastStep;
    store.skip();
    if (wasLastStep) {
      finish();
    }
  }

  return (
    <OnboardingView
      store={store}
      onLocaleChange={setLocale}
      onBack={store.back.bind(store)}
      onNext={handleNext}
      onSkip={handleSkip}
      saveFailed={saveFailed}
    />
  );
});
