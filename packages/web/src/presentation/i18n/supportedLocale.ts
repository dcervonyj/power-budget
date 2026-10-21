import type { SupportedLocale } from '@power-budget/core';

const SUPPORTED: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

function isSupported(language: string): language is SupportedLocale {
  return SUPPORTED.some((locale) => locale === language);
}

/** The react-intl locale ('pl', 'pl-PL', ...) as a core formatting locale. */
export function toSupportedLocale(locale: string): SupportedLocale {
  const language = locale.split('-')[0] ?? '';

  return isSupported(language) ? language : 'en';
}
