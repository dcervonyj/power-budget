import React from 'react';
import { useIntl } from 'react-intl';
import type { SelectOption } from '@power-budget/shared-app';
import { Button } from '../../components/Button.js';
import { Select } from '../../components/Select.js';
import { AuthHeading, AuthLayout, AuthNotice } from '../auth/AuthParts.js';

export type OnboardingLocale = 'en' | 'uk' | 'ru' | 'pl';

export interface OnboardingViewProps {
  readonly language: OnboardingLocale;
  readonly baseCurrency: string;
  readonly loading: boolean;
  /** Saving to the profile failed; the form stays for another try. */
  readonly failed: boolean;
  readonly onLanguageChange: (value: OnboardingLocale) => void;
  readonly onBaseCurrencyChange: (value: string) => void;
  readonly onSubmit: () => void;
}

const LANGUAGE_OPTIONS: ReadonlyArray<SelectOption<OnboardingLocale>> = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'pl', label: 'Polski' },
];

const CURRENCY_OPTIONS: ReadonlyArray<SelectOption> = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'UAH',
  'CHF',
  'CZK',
].map((code) => ({ value: code, label: code }));

export function OnboardingView(props: OnboardingViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <AuthLayout>
      <AuthHeading
        title={intl.formatMessage({
          id: 'onboarding.title',
          defaultMessage: 'Welcome to Power Budget',
        })}
        subtitle={intl.formatMessage({
          id: 'onboarding.subtitle',
          defaultMessage: 'Choose your language and base currency. You can change them later.',
        })}
      />
      <Select<OnboardingLocale>
        label={intl.formatMessage({ id: 'onboarding.language', defaultMessage: 'Language' })}
        options={LANGUAGE_OPTIONS}
        value={props.language}
        onChange={props.onLanguageChange}
      />
      <Select
        label={intl.formatMessage({
          id: 'onboarding.baseCurrency',
          defaultMessage: 'Base currency',
        })}
        options={CURRENCY_OPTIONS}
        value={props.baseCurrency}
        onChange={props.onBaseCurrencyChange}
      />
      {props.failed && (
        <AuthNotice
          message={intl.formatMessage({
            id: 'onboarding.error.saveFailed',
            defaultMessage: 'We could not save your choices. Try again.',
          })}
        />
      )}
      <Button loading={props.loading} onPress={props.onSubmit}>
        {intl.formatMessage({ id: 'onboarding.submit', defaultMessage: 'Continue' })}
      </Button>
    </AuthLayout>
  );
}
