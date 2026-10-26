import React from 'react';
import { useIntl } from 'react-intl';
import type { SupportedLocale } from '@power-budget/core';
import type { SelectOption } from '@power-budget/shared-app';
import { Select } from '../components/Select.js';

/** Each language is named in itself, so a user who cannot read the current one still finds theirs. */
const LOCALE_OPTIONS: ReadonlyArray<SelectOption<SupportedLocale>> = [
  { value: 'en', label: 'English' },
  { value: 'uk', label: 'Українська' },
  { value: 'ru', label: 'Русский' },
  { value: 'pl', label: 'Polski' },
];

export interface LocaleSelectProps {
  readonly locale: SupportedLocale;
  readonly onChange: (locale: SupportedLocale) => void;
  readonly id: string;
}

/** Glass language picker (props only); `LocaleSwitcher` wires it to the app locale. */
export function LocaleSelect({ locale, onChange, id }: LocaleSelectProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <Select<SupportedLocale>
      id={id}
      label={intl.formatMessage({
        id: 'component.localeSwitcher.label',
        defaultMessage: 'Language',
      })}
      options={LOCALE_OPTIONS}
      value={locale}
      onChange={onChange}
    />
  );
}
