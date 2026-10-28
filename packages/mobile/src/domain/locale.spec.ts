import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isSupportedLocale, languageOf, toSupportedLocale } from './locale.js';

describe('locale', () => {
  it('takes the language of a tag', () => {
    expect(languageOf('pl-PL')).toBe('pl');
    expect(languageOf('uk')).toBe('uk');
    expect(languageOf('')).toBe('');
  });

  it('recognises only shipped locales', () => {
    expect(isSupportedLocale('ru')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
  });

  it('maps a tag to a supported locale, the default otherwise', () => {
    expect(toSupportedLocale('uk-UA')).toBe('uk');
    expect(toSupportedLocale('de-DE')).toBe(DEFAULT_LOCALE);
    expect(toSupportedLocale('')).toBe(DEFAULT_LOCALE);
  });
});
