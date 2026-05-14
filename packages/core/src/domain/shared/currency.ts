export type CurrencyCode =
  | 'PLN'
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'UAH'
  | 'RUB'
  | 'CHF'
  | 'CZK'
  | 'SEK'
  | 'NOK'
  | 'DKK';

export interface Currency {
  readonly code: CurrencyCode;
  readonly minorUnitExponent: number;
  readonly symbol: string;
}

export const CURRENCIES: Readonly<Record<CurrencyCode, Currency>> = {
  PLN: { code: 'PLN', minorUnitExponent: 2, symbol: 'zł' },
  EUR: { code: 'EUR', minorUnitExponent: 2, symbol: '€' },
  USD: { code: 'USD', minorUnitExponent: 2, symbol: '$' },
  GBP: { code: 'GBP', minorUnitExponent: 2, symbol: '£' },
  UAH: { code: 'UAH', minorUnitExponent: 2, symbol: '₴' },
  RUB: { code: 'RUB', minorUnitExponent: 2, symbol: '₽' },
  CHF: { code: 'CHF', minorUnitExponent: 2, symbol: 'CHF' },
  CZK: { code: 'CZK', minorUnitExponent: 2, symbol: 'Kč' },
  SEK: { code: 'SEK', minorUnitExponent: 2, symbol: 'kr' },
  NOK: { code: 'NOK', minorUnitExponent: 2, symbol: 'kr' },
  DKK: { code: 'DKK', minorUnitExponent: 2, symbol: 'kr' },
};

export function getCurrency(code: CurrencyCode): Currency {
  return CURRENCIES[code];
}

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}
