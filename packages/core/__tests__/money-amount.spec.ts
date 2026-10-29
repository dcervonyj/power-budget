import { describe, it, expect } from 'vitest';
import {
  formatMoneyInput,
  getMinorUnitExponent,
  parseMinorUnits,
  parseMoney,
} from '../src/logic/money-amount.js';
import { formatMoney } from '../src/logic/format.js';
import { InvalidMoneyAmountError } from '../src/domain/shared/errors.js';

describe('getMinorUnitExponent', () => {
  it('uses the core table for supported currencies', () => {
    expect(getMinorUnitExponent('PLN')).toBe(2);
    expect(getMinorUnitExponent('EUR')).toBe(2);
  });

  it('falls back to Intl for other ISO 4217 codes', () => {
    expect(getMinorUnitExponent('JPY')).toBe(0);
    expect(getMinorUnitExponent('KWD')).toBe(3);
  });

  it('rejects an unknown currency code', () => {
    expect(() => getMinorUnitExponent('NOPE')).toThrow(InvalidMoneyAmountError);
  });
});

describe('parseMoney', () => {
  it('parses PLN with a comma or dot decimal separator', () => {
    expect(parseMoney('12,50', 'PLN')).toBe(1250n);
    expect(parseMoney('12.5', 'PLN')).toBe(1250n);
    expect(parseMoney('1 234,56', 'PLN')).toBe(123456n);
    expect(parseMoney('1.234,56', 'PLN')).toBe(123456n);
  });

  it('parses EUR with grouping and whole amounts', () => {
    expect(parseMoney('1,234.56', 'EUR')).toBe(123456n);
    expect(parseMoney('1,000,000', 'EUR')).toBe(100000000n);
    expect(parseMoney('100', 'EUR')).toBe(10000n);
    expect(parseMoney('.5', 'EUR')).toBe(50n);
  });

  it('is exact where a float is not (0.29 * 100 = 28.999...)', () => {
    expect(parseMoney('0.29', 'EUR')).toBe(29n);
    expect(parseMoney('1.005', 'KWD')).toBe(1005n);
  });

  it('keeps every digit above Number.MAX_SAFE_INTEGER', () => {
    expect(parseMoney('1234567890123456.78', 'EUR')).toBe(123456789012345678n);
  });

  it('uses exponent 0 for JPY', () => {
    expect(parseMoney('1500', 'JPY')).toBe(1500n);
    expect(() => parseMoney('1500.5', 'JPY')).toThrow(InvalidMoneyAmountError);
  });

  it('parses negative amounts', () => {
    expect(parseMoney('-12.34', 'PLN')).toBe(-1234n);
    expect(parseMoney('−12,34', 'PLN')).toBe(-1234n);
    expect(parseMoney('-1500', 'JPY')).toBe(-1500n);
    expect(parseMoney('+3', 'EUR')).toBe(300n);
  });

  it('rejects more fraction digits than the currency has instead of rounding', () => {
    expect(() => parseMoney('1.999', 'EUR')).toThrow(InvalidMoneyAmountError);
  });

  it('rejects input that is not a number', () => {
    for (const input of ['', '  ', '-', 'abc', '1.2.3', '12e3', '1-2', '1,23,45.6.7']) {
      expect(() => parseMoney(input, 'EUR')).toThrow(InvalidMoneyAmountError);
    }
  });
});

describe('parseMinorUnits', () => {
  it('parses the API integer string', () => {
    expect(parseMinorUnits('150000')).toBe(150000n);
    expect(parseMinorUnits('-1500')).toBe(-1500n);
    expect(parseMinorUnits('9007199254740993')).toBe(9007199254740993n);
  });

  it('rejects anything but an integer string', () => {
    for (const wire of ['', '1.5', '1e3', 'NaN', ' 1']) {
      expect(() => parseMinorUnits(wire)).toThrow(InvalidMoneyAmountError);
    }
  });
});

describe('formatMoneyInput', () => {
  it('formats minor units as plain major units', () => {
    expect(formatMoneyInput(123450n, 'PLN')).toBe('1234.50');
    expect(formatMoneyInput(5n, 'EUR')).toBe('0.05');
    expect(formatMoneyInput(-1234n, 'EUR')).toBe('-12.34');
    expect(formatMoneyInput(-5n, 'EUR')).toBe('-0.05');
    expect(formatMoneyInput(1500n, 'JPY')).toBe('1500');
    expect(formatMoneyInput(-1500n, 'JPY')).toBe('-1500');
  });

  it('round-trips with parseMoney', () => {
    for (const amount of [0n, 1n, -1n, 99n, 100n, 123456789012345678n, -100001n]) {
      expect(parseMoney(formatMoneyInput(amount, 'PLN'), 'PLN')).toBe(amount);
    }
  });
});

describe('formatMoney with the currency exponent', () => {
  it('formats PLN and EUR with two decimals', () => {
    expect(formatMoney({ amountMinor: 123456n, currency: 'PLN' }, 'en')).toBe('zł\u00a01,234.56');
    expect(formatMoney({ amountMinor: 1099n, currency: 'EUR' }, 'en')).toBe('€10.99');
  });

  it('formats JPY without decimals', () => {
    expect(formatMoney({ amountMinor: 1500n, currency: 'JPY' }, 'en')).toBe('¥1,500');
  });

  it('formats negative amounts', () => {
    expect(formatMoney({ amountMinor: -1234n, currency: 'EUR' }, 'en')).toBe('\u2212€12.34');
    expect(formatMoney({ amountMinor: -5n, currency: 'EUR' }, 'en')).toBe('\u2212€0.05');
    expect(formatMoney({ amountMinor: -1500n, currency: 'JPY' }, 'en')).toBe('\u2212¥1,500');
  });
});
