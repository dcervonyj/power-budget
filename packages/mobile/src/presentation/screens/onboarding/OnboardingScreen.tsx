import React, { useState } from 'react';
import type { OnboardingApi } from '@power-budget/shared-app';
import { useAppLocale } from '../../LocaleProvider.js';
import { OnboardingView, type OnboardingLocale } from './OnboardingView.js';

export interface OnboardingScreenProps {
  readonly api: Pick<OnboardingApi, 'complete'>;
  /** Current session id: a locale chosen under an older session is dropped. */
  readonly getSessionId: () => number;
  /** The choices are saved on the profile: the app opens. */
  readonly onCompleted: () => void;
}

/** First screen of a new user (CLN-073): language and base currency, saved to the profile. */
export function OnboardingScreen({
  api,
  getSessionId,
  onCompleted,
}: OnboardingScreenProps): React.JSX.Element {
  const { setLocale } = useAppLocale();
  const [language, setLanguage] = useState<OnboardingLocale>('en');
  const [baseCurrency, setBaseCurrency] = useState('PLN');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (): Promise<void> => {
    setLoading(true);
    setFailed(false);
    const sessionId = getSessionId();
    try {
      await api.complete({ language, baseCurrency });
      setLocale(language, 'user', sessionId);
      onCompleted();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const submit = (): void => {
    void save();
  };

  return (
    <OnboardingView
      language={language}
      baseCurrency={baseCurrency}
      loading={loading}
      failed={failed}
      onLanguageChange={setLanguage}
      onBaseCurrencyChange={setBaseCurrency}
      onSubmit={submit}
    />
  );
}
