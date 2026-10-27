import type { SupportedLocale } from '@power-budget/core';

export const MAX_INTERESTING_CURRENCIES = 5;

export const BASE_CURRENCY_OPTIONS: readonly string[] = [
  'USD',
  'EUR',
  'GBP',
  'PLN',
  'UAH',
  'CHF',
  'CZK',
];

export const INTERESTING_CURRENCY_OPTIONS: readonly string[] = [
  ...BASE_CURRENCY_OPTIONS,
  'JPY',
  'CAD',
  'AUD',
];

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'uk', 'ru', 'pl'];

export function isSupportedLocale(lang: string): lang is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === lang);
}

/** Adds or removes `code`; a new code is ignored once the maximum is reached. */
export function toggleInterestingCurrency(selected: readonly string[], code: string): string[] {
  if (selected.includes(code)) {
    return selected.filter((current) => current !== code);
  }
  if (selected.length >= MAX_INTERESTING_CURRENCIES) {
    return [...selected];
  }

  return [...selected, code];
}
