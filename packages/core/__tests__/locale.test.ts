import { describe, it, expect } from 'vitest';
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from '../src/domain/shared/locale.js';

describe('isSupportedLocale', () => {
  it.each(['en', 'uk', 'ru', 'pl'] as const)('returns true for %s', (code) => {
    expect(isSupportedLocale(code)).toBe(true);
  });

  it('returns false for unsupported locale', () => {
    expect(isSupportedLocale('de')).toBe(false);
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });
});

describe('SUPPORTED_LOCALES', () => {
  it('contains exactly the 4 MVP locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'uk', 'ru', 'pl']);
  });
});

describe('DEFAULT_LOCALE', () => {
  it('is en', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});
