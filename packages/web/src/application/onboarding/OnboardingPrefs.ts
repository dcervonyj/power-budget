import { isSupportedLocale } from './OnboardingOptions.js';

export interface OnboardingPrefs {
  readonly baseCurrency: string;
  readonly interestingCurrencies: readonly string[];
  readonly language: string;
}

/** Device-local preferences chosen in the wizard (the same keys the settings tabs read). */
export function persistOnboardingPrefs(storage: Storage, prefs: OnboardingPrefs): void {
  storage.setItem('pb_base_currency', prefs.baseCurrency);
  storage.setItem('pb_interesting_currencies', JSON.stringify(prefs.interestingCurrencies));
  if (isSupportedLocale(prefs.language)) {
    storage.setItem('pb_locale', prefs.language);
  }
}
