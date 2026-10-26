import { describe, expect, it } from 'vitest';
import type { FxRateTable } from '../../../../infrastructure/fx/FxRateCache.js';
import { convertDisplayMoney, displayFxRatio, formatDisplayRate } from '../convertDisplayMoney.js';

const TABLE: FxRateTable = {
  baseCurrency: 'EUR',
  rates: { PLN: 4.2823, USD: 1.1, JPY: 160, TINY: 1e-7 },
  fetchedAt: '2026-10-21T00:00:00Z',
};

describe('convertDisplayMoney', () => {
  it('converts from the base currency with exact decimal rates', () => {
    expect(convertDisplayMoney({ amountMinor: 100000n, currency: 'EUR' }, 'PLN', TABLE)).toEqual({
      amountMinor: 428230n,
      currency: 'PLN',
    });
  });

  it('converts to the base currency and between two quotes', () => {
    expect(convertDisplayMoney({ amountMinor: 428230n, currency: 'PLN' }, 'EUR', TABLE)).toEqual({
      amountMinor: 100000n,
      currency: 'EUR',
    });
    expect(convertDisplayMoney({ amountMinor: 11000n, currency: 'USD' }, 'PLN', TABLE)).toEqual({
      amountMinor: 42823n,
      currency: 'PLN',
    });
  });

  it('honours different minor-unit exponents', () => {
    expect(convertDisplayMoney({ amountMinor: 100n, currency: 'EUR' }, 'JPY', TABLE)).toEqual({
      amountMinor: 160n,
      currency: 'JPY',
    });
  });

  it('shows no float rounding error where a float computation would', () => {
    const huge = 9007199254740993n;
    const sameValueRate: FxRateTable = { ...TABLE, rates: { PLN: 1 } };
    const floatResult = Number(huge) * 1;

    expect(BigInt(floatResult)).not.toBe(huge);
    expect(
      convertDisplayMoney({ amountMinor: huge, currency: 'PLN' }, 'EUR', sameValueRate),
    ).toEqual({ amountMinor: huge, currency: 'EUR' });
  });

  it('rounds half to even once, also for negatives', () => {
    const half: FxRateTable = { ...TABLE, rates: { PLN: 0.5 } };

    expect(
      convertDisplayMoney({ amountMinor: 5n, currency: 'EUR' }, 'PLN', half)?.amountMinor,
    ).toBe(2n);
    expect(
      convertDisplayMoney({ amountMinor: 3n, currency: 'EUR' }, 'PLN', half)?.amountMinor,
    ).toBe(2n);
    expect(
      convertDisplayMoney({ amountMinor: -5n, currency: 'EUR' }, 'PLN', half)?.amountMinor,
    ).toBe(-2n);
  });

  it('returns null when a rate is missing and parses exponent-notation rates', () => {
    expect(convertDisplayMoney({ amountMinor: 1n, currency: 'EUR' }, 'CHF', TABLE)).toBeNull();
    expect(displayFxRatio('EUR', 'TINY', TABLE)).not.toBeNull();
  });

  it('formats the tooltip rate with four decimals', () => {
    const ratio = displayFxRatio('EUR', 'PLN', TABLE);

    expect(ratio === null ? null : formatDisplayRate(ratio)).toBe('4.2823');
  });
});
