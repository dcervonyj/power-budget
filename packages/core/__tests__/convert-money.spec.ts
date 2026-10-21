import { describe, it, expect } from 'vitest';
import {
  convertMoney,
  resolveFxRate,
  UnknownCurrencyPairError,
} from '../src/logic/convert-money.js';
import { InvalidFxRateError } from '../src/logic/fx-ratio.js';
import type { FxRate, FxRateTable } from '../src/domain/currency/entities.js';
import type { CurrencyCode } from '../src/domain/shared/currency.js';
import { FxRateId } from '../src/domain/currency/ids.js';
import { IsoDate, IsoDateTime } from '../src/domain/shared/ids.js';

function makeRate(base: CurrencyCode, quote: CurrencyCode, rate: string): FxRate {
  return {
    id: FxRateId.of('01936d3e-8000-7000-a000-000000000001'),
    baseCurrency: base,
    quoteCurrency: quote,
    rate,
    rateDate: IsoDate.of('2026-10-20'),
    source: 'ecb',
    fetchedAt: IsoDateTime.of('2026-10-20T15:00:00.000Z'),
  };
}

function table(...rates: FxRate[]): FxRateTable {
  return new Map(rates.map((r) => [`${r.baseCurrency}/${r.quoteCurrency}`, r]));
}

// Real ECB reference rates of 2026-10-20 (1 EUR = x).
const ECB = table(
  makeRate('EUR', 'PLN', '4.3768'),
  makeRate('EUR', 'USD', '1.1215'),
  makeRate('EUR', 'GBP', '0.84028'),
);

describe('convertMoney', () => {
  it('returns the same object when the currency already matches', () => {
    const money = { amountMinor: 1234n, currency: 'PLN' as const };

    expect(convertMoney(money, 'PLN', new Map())).toBe(money);
  });

  it('converts with a direct rate', () => {
    // 100.00 EUR × 4.3768 = 437.68 PLN
    expect(convertMoney({ amountMinor: 10_000n, currency: 'EUR' }, 'PLN', ECB)).toEqual({
      amountMinor: 43_768n,
      currency: 'PLN',
    });
  });

  it('converts with the inverse of a stored rate', () => {
    // 437.68 PLN / 4.3768 = 100.00 EUR exactly
    expect(convertMoney({ amountMinor: 43_768n, currency: 'PLN' }, 'EUR', ECB)).toEqual({
      amountMinor: 10_000n,
      currency: 'EUR',
    });
  });

  it('pivots through EUR when both legs are stored as EUR/x (no X/EUR row needed)', () => {
    // 100.00 PLN → USD = 10000 × 1.1215 / 4.3768 = 2562.37... → 2562
    expect(convertMoney({ amountMinor: 10_000n, currency: 'PLN' }, 'USD', ECB)).toEqual({
      amountMinor: 2_562n,
      currency: 'USD',
    });
    // 100.00 USD → GBP = 10000 × 0.84028 / 1.1215 = 7492.46... → 7492
    expect(convertMoney({ amountMinor: 10_000n, currency: 'USD' }, 'GBP', ECB).amountMinor).toBe(
      7_492n,
    );
  });

  it('pivots with an x/EUR row on the first leg', () => {
    const rates = table(makeRate('PLN', 'EUR', '0.25'), makeRate('EUR', 'USD', '1.1'));

    // 10.00 PLN → 2.50 EUR → 2.75 USD
    expect(convertMoney({ amountMinor: 1_000n, currency: 'PLN' }, 'USD', rates).amountMinor).toBe(
      275n,
    );
  });

  it('prefers a direct cross row over the EUR pivot', () => {
    const rates = table(
      makeRate('EUR', 'PLN', '4'),
      makeRate('EUR', 'UAH', '48'),
      makeRate('UAH', 'PLN', '0.1'),
    );

    expect(convertMoney({ amountMinor: 1_000n, currency: 'UAH' }, 'PLN', rates).amountMinor).toBe(
      100n,
    );
  });

  it('keeps full precision through a pivot instead of rounding each leg', () => {
    // 1 PLN → EUR → PLN round trip through a 3-decimal rate stays exact.
    const rates = table(makeRate('EUR', 'PLN', '3'), makeRate('EUR', 'USD', '3'));

    // 0.01 PLN = 0.003333.. EUR = 0.01 USD; per-leg rounding would give 0.00 USD.
    expect(convertMoney({ amountMinor: 1n, currency: 'PLN' }, 'USD', rates).amountMinor).toBe(1n);
  });

  describe('rounds half to even', () => {
    const half = table(makeRate('EUR', 'PLN', '0.5'));

    it.each([
      [1n, 0n], // 0.5 → 0 (even)
      [3n, 2n], // 1.5 → 2 (even)
      [5n, 2n], // 2.5 → 2 (even)
      [7n, 4n], // 3.5 → 4 (even)
    ])('%s × 0.5 → %s', (amountMinor, expected) => {
      expect(convertMoney({ amountMinor, currency: 'EUR' }, 'PLN', half).amountMinor).toBe(
        expected,
      );
    });

    it('rounds away from a non-half remainder normally', () => {
      const rates = table(makeRate('EUR', 'PLN', '0.26'));

      // 10 × 0.26 = 2.6 → 3; 10 × 0.24 = 2.4 → 2
      expect(convertMoney({ amountMinor: 10n, currency: 'EUR' }, 'PLN', rates).amountMinor).toBe(
        3n,
      );
    });

    it('is symmetric for negative amounts (a refund mirrors the charge)', () => {
      expect(convertMoney({ amountMinor: -5n, currency: 'EUR' }, 'PLN', half).amountMinor).toBe(
        -2n,
      );
      expect(convertMoney({ amountMinor: -10_000n, currency: 'PLN' }, 'USD', ECB).amountMinor).toBe(
        -2_562n,
      );
    });
  });

  it('converts zero to zero', () => {
    expect(convertMoney({ amountMinor: 0n, currency: 'PLN' }, 'GBP', ECB)).toEqual({
      amountMinor: 0n,
      currency: 'GBP',
    });
  });

  it('throws UnknownCurrencyPairError when no direct, inverse or pivot path exists', () => {
    expect(() => convertMoney({ amountMinor: 1_000n, currency: 'PLN' }, 'UAH', ECB)).toThrow(
      UnknownCurrencyPairError,
    );
    expect(() => convertMoney({ amountMinor: 1_000n, currency: 'EUR' }, 'UAH', ECB)).toThrow(
      'No FX rate for EUR/UAH',
    );
  });

  it('throws InvalidFxRateError on a zero rate instead of dividing by zero', () => {
    const zero = table(makeRate('EUR', 'PLN', '0'));

    expect(() => convertMoney({ amountMinor: 1_000n, currency: 'PLN' }, 'EUR', zero)).toThrow(
      InvalidFxRateError,
    );
    expect(() => convertMoney({ amountMinor: 1_000n, currency: 'EUR' }, 'PLN', zero)).toThrow(
      InvalidFxRateError,
    );
  });

  it('throws InvalidFxRateError on a malformed rate', () => {
    const malformed = table(makeRate('EUR', 'PLN', '4.2e1'));

    expect(() => convertMoney({ amountMinor: 1n, currency: 'EUR' }, 'PLN', malformed)).toThrow(
      InvalidFxRateError,
    );
  });
});

describe('resolveFxRate', () => {
  it('returns 1/1 for the same currency', () => {
    expect(resolveFxRate('PLN', 'PLN', new Map())).toEqual({ numerator: 1n, denominator: 1n });
  });

  it('returns the exact ratio of a pivot', () => {
    // PLN → USD = 1.1215 / 4.3768 = 11215 / 43768
    expect(resolveFxRate('PLN', 'USD', ECB)).toEqual({
      numerator: 11_215n * 10_000n,
      denominator: 10_000n * 43_768n,
    });
  });

  it('returns null when a pivot leg is missing', () => {
    expect(resolveFxRate('PLN', 'UAH', ECB)).toBeNull();
  });
});
