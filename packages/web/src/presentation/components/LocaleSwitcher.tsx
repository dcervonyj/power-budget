import React, { useContext } from 'react';
import { FormattedMessage } from 'react-intl';
import { LocaleContext, apiClient } from '../../AppProviders.js';
import type { SupportedLocale } from '../../AppProviders.js';

const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  pl: 'Polski',
};

const LOCALE_OPTIONS: SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

export function LocaleSwitcher(): React.JSX.Element {
  const { locale, setLocale } = useContext(LocaleContext);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const newLocale = event.target.value as SupportedLocale;
    setLocale(newLocale);
    localStorage.setItem('pb_locale', newLocale);
    void apiClient
      .request<unknown>({ url: '/users/me/locale', method: 'PATCH', body: { locale: newLocale } })
      .catch(() => undefined);
  }

  return (
    <div>
      <label htmlFor="locale-select">
        <FormattedMessage id="component.localeSwitcher.label" defaultMessage="Language" />
      </label>
      <select id="locale-select" value={locale} onChange={handleChange}>
        {LOCALE_OPTIONS.map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
