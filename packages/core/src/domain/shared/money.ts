import type { CurrencyCode } from './currency.js';
import { CurrencyMismatchError } from './errors.js';

export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export const Money = {
  of(amountMinor: bigint, currency: CurrencyCode): Money {
    return { amountMinor, currency };
  },

  zero(currency: CurrencyCode): Money {
    return { amountMinor: 0n, currency };
  },

  assertSameCurrency(a: Money, b: Money): void {
    if (a.currency !== b.currency) {
      throw new CurrencyMismatchError(a.currency, b.currency);
    }
  },

  add(a: Money, b: Money): Money {
    Money.assertSameCurrency(a, b);
    return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
  },

  sub(a: Money, b: Money): Money {
    Money.assertSameCurrency(a, b);
    return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
  },

  negate(m: Money): Money {
    return { amountMinor: -m.amountMinor, currency: m.currency };
  },

  multiply(m: Money, factor: bigint): Money {
    return { amountMinor: m.amountMinor * factor, currency: m.currency };
  },

  equals(a: Money, b: Money): boolean {
    return a.currency === b.currency && a.amountMinor === b.amountMinor;
  },

  compare(a: Money, b: Money): -1 | 0 | 1 {
    Money.assertSameCurrency(a, b);
    if (a.amountMinor < b.amountMinor) return -1;
    if (a.amountMinor > b.amountMinor) return 1;
    return 0;
  },

  isZero(m: Money): boolean {
    return m.amountMinor === 0n;
  },
};
