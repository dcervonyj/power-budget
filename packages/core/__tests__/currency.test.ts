import { describe, it, expect } from 'vitest';
import { getCurrency, isSupportedCurrency, CURRENCIES } from '../src/domain/shared/currency.js';

describe('getCurrency', () => {
  it('returns PLN currency info', () => {
    const pln = getCurrency('PLN');
    expect(pln.code).toBe('PLN');
    expect(pln.symbol).toBe('zł');
    expect(pln.minorUnitExponent).toBe(2);
  });

  it('returns EUR currency info', () => {
    const eur = getCurrency('EUR');
    expect(eur.code).toBe('EUR');
    expect(eur.symbol).toBe('€');
  });

  it('returns all 11 MVP currencies', () => {
    expect(Object.keys(CURRENCIES)).toHaveLength(11);
  });
});

describe('isSupportedCurrency', () => {
  it('returns true for PLN', () => {
    expect(isSupportedCurrency('PLN')).toBe(true);
  });

  it('returns true for all supported currencies', () => {
    const codes = ['PLN', 'EUR', 'USD', 'GBP', 'UAH', 'RUB', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK'];
    for (const code of codes) {
      expect(isSupportedCurrency(code)).toBe(true);
    }
  });

  it('returns false for unknown currency', () => {
    expect(isSupportedCurrency('xxx')).toBe(false);
    expect(isSupportedCurrency('JPY')).toBe(false);
    expect(isSupportedCurrency('')).toBe(false);
  });
});
