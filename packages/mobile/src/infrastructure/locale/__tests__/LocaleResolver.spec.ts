import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCALE, languageOf } from '../../../domain/locale.js';
import { LocaleResolver } from '../LocaleResolver.js';

describe('LocaleResolver', () => {
  const resolver = new LocaleResolver();

  it('returns stored locale when it is supported', () => {
    expect(resolver.resolve('en', 'pl')).toBe('pl');
  });

  it('returns device locale when no stored preference', () => {
    expect(resolver.resolve('uk', null)).toBe('uk');
  });

  it('falls back to en for unsupported device locale', () => {
    expect(resolver.resolve('zh', null)).toBe('en');
  });

  it('falls back to en when stored locale is unsupported', () => {
    expect(resolver.resolve('de', 'zh')).toBe('en');
  });

  it('resolves Polish device locale correctly', () => {
    expect(resolver.resolve('pl', null)).toBe('pl');
  });

  it('ignores stored locale if unsupported, uses valid device locale', () => {
    expect(resolver.resolve('uk', 'invalid')).toBe('uk');
  });

  it('strips region tag from device language code', () => {
    expect(resolver.resolve('pl-PL', null)).toBe('pl');
  });

  it('returns en for undefined stored value', () => {
    expect(resolver.resolve('zh', undefined)).toBe('en');
  });

  it('keeps a language tag without a region whole', () => {
    expect(languageOf('uk')).toBe('uk');
    expect(languageOf('pl-PL')).toBe('pl');
    expect(languageOf('')).toBe('');
  });

  it('resolves an empty device language to the default locale', () => {
    expect(resolver.resolve('', null)).toBe(DEFAULT_LOCALE);
  });
});
