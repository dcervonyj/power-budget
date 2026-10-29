import React, { useContext, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { persistOnboardingPrefs } from '../../../application/onboarding/OnboardingPrefs.js';
import { onboardingProgress, onboardingService } from '../../../composition.js';
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
  // Kept outside the component: the bank and plan links leave the wizard and come back to it.
  const [store] = useState(() => onboardingProgress.resume());
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
    onboardingProgress.clear();
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
