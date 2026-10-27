import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { SupportedLocale } from '@power-budget/core';
import type { OnboardingStore } from '../../../application/onboarding/OnboardingStore.js';
import { isSupportedLocale } from '../../../application/onboarding/OnboardingOptions.js';
import { RadioGroup, type RadioOption } from '../../glass/controls/RadioGroup.js';
import { STACK_STYLE, STEP_STYLE, STEP_TITLE_STYLE, optionRowStyle } from './onboardingStyles.js';

interface StepLanguageProps {
  store: OnboardingStore;
  onLocaleChange: (locale: SupportedLocale) => void;
}

/** Each language is named in itself, so a user who cannot read the current one still finds theirs. */
const LANGUAGE_OPTIONS: ReadonlyArray<RadioOption<SupportedLocale>> = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'pl', label: 'Polski' },
];

export const StepLanguage = observer(function StepLanguage({
  store,
  onLocaleChange,
}: StepLanguageProps): React.JSX.Element {
  const intl = useIntl();
  const selected = isSupportedLocale(store.selectedLanguage) ? store.selectedLanguage : 'en';

  function handleSelect(code: SupportedLocale): void {
    store.setLanguage(code);
    onLocaleChange(code);
    localStorage.setItem('pb_locale', code);
  }

  return (
    <div style={STEP_STYLE}>
      <h1 style={STEP_TITLE_STYLE}>
        <FormattedMessage
          id="onboarding.step.language.title"
          defaultMessage="Choose your language"
        />
      </h1>
      <RadioGroup<SupportedLocale>
        options={LANGUAGE_OPTIONS}
        value={selected}
        onChange={handleSelect}
        label={intl.formatMessage({
          id: 'onboarding.step.language.title',
          defaultMessage: 'Choose your language',
        })}
        groupStyle={STACK_STYLE}
        optionStyle={optionRowStyle}
      />
    </div>
  );
});
