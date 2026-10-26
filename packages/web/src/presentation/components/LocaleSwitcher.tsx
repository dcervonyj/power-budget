import React, { useContext } from 'react';
import type { UpdateLocaleDto } from '@power-budget/shared-app/contract';
import { LocaleContext, apiClient, tokenStore } from '../../AppProviders.js';
import type { SupportedLocale } from '../../AppProviders.js';
import { LocaleSelect } from '../shell/LocaleSelect.js';

export interface LocaleChoice {
  readonly locale: SupportedLocale;
  readonly changeLocale: (locale: SupportedLocale) => void;
}

/**
 * The app language and its setter. The choice is applied and stored on this device first; when
 * someone is signed in, the profile copy is saved best effort (signed out, there is no profile,
 * and an unauthenticated call would end on the login screen).
 */
export function useLocaleChoice(): LocaleChoice {
  const { locale, setLocale } = useContext(LocaleContext);

  function changeLocale(next: SupportedLocale): void {
    setLocale(next);
    localStorage.setItem('pb_locale', next);
    if (!tokenStore.getAccessToken()) {
      return;
    }
    const body: UpdateLocaleDto = { locale: next };
    void apiClient.patch('/users/me/locale', body).catch(ignoreFailure);
  }

  return { locale, changeLocale };
}

export interface LocaleSwitcherProps {
  /** Id of the select; give each switcher on a page its own. */
  readonly id?: string;
}

export function LocaleSwitcher({ id = 'locale-select' }: LocaleSwitcherProps): React.JSX.Element {
  const { locale, changeLocale } = useLocaleChoice();

  return <LocaleSelect id={id} locale={locale} onChange={changeLocale} />;
}

function ignoreFailure(): undefined {
  return undefined;
}
