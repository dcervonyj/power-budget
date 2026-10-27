import { describe, expect, it } from 'vitest';
import { isSupportedLocale, toggleInterestingCurrency } from './OnboardingOptions.js';

describe('toggleInterestingCurrency', () => {
  it('adds a currency and removes it again', () => {
    expect(toggleInterestingCurrency(['EUR'], 'GBP')).toEqual(['EUR', 'GBP']);
    expect(toggleInterestingCurrency(['EUR', 'GBP'], 'EUR')).toEqual(['GBP']);
  });

  it('ignores a sixth currency but still removes one', () => {
    const full = ['EUR', 'GBP', 'PLN', 'UAH', 'CHF'];

    expect(toggleInterestingCurrency(full, 'CZK')).toEqual(full);
    expect(toggleInterestingCurrency(full, 'CHF')).toEqual(['EUR', 'GBP', 'PLN', 'UAH']);
  });
});

describe('isSupportedLocale', () => {
  it('accepts the four app languages only', () => {
    expect(isSupportedLocale('uk')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
  });
});
