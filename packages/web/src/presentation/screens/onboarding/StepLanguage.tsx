import React from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import type { SupportedLocale } from '../../../AppProviders.js';

interface StepLanguageProps {
  store: OnboardingStore;
  onLocaleChange: (locale: SupportedLocale) => void;
}

const LANGUAGE_OPTIONS: { code: SupportedLocale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'pl', label: 'Polski' },
];

export const StepLanguage = observer(function StepLanguage({
  store,
  onLocaleChange,
}: StepLanguageProps): React.JSX.Element {
  function handleSelect(code: SupportedLocale): void {
    store.setLanguage(code);
    onLocaleChange(code);
    localStorage.setItem('pb_locale', code);
  }

  return (
    <div>
      <h2>
        <FormattedMessage
          id="onboarding.step.language.title"
          defaultMessage="Choose your language"
        />
      </h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {LANGUAGE_OPTIONS.map(({ code, label }) => (
          <li key={code} style={{ marginBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleSelect(code)}
              aria-pressed={store.selectedLanguage === code}
              style={{
                fontWeight: store.selectedLanguage === code ? 'bold' : 'normal',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
                border: store.selectedLanguage === code ? '2px solid #333' : '1px solid #ccc',
                borderRadius: '4px',
                background: store.selectedLanguage === code ? '#f0f0f0' : 'transparent',
                width: '100%',
                textAlign: 'left',
              }}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});
