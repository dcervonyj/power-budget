import { describe, it, expect } from 'vitest';
import {
  divideFxRatios,
  divideRoundHalfEven,
  formatFxRatio,
  InvalidFxRateError,
  invertFxRatio,
  parseFxRate,
} from '../src/logic/fx-ratio.js';

describe('parseFxRate', () => {
  it.each([
    ['4.3768', 43_768n, 10_000n],
    ['48', 48n, 1n],
    ['0.012042', 12_042n, 1_000_000n],
    ['4.3768000000', 43_768_000_000n, 10_000_000_000n],
  ])('parses %s exactly', (value, numerator, denominator) => {
    expect(parseFxRate(value)).toEqual({ numerator, denominator });
  });

  it.each(['0', '0.0000', '-1.2', '1e3', '', 'abc', '1.', '.5', 'NaN'])('rejects "%s"', (value) => {
    expect(() => parseFxRate(value)).toThrow(InvalidFxRateError);
  });
});

describe('divideRoundHalfEven', () => {
  it.each([
    [10n, 4n, 2n], // 2.5 → 2
    [14n, 4n, 4n], // 3.5 → 4
    [11n, 4n, 3n], // 2.75 → 3
    [9n, 4n, 2n], // 2.25 → 2
    [-10n, 4n, -2n],
    [-14n, 4n, -4n],
    [-11n, 4n, -3n],
    [0n, 7n, 0n],
  ])('%s / %s → %s', (dividend, divisor, expected) => {
    expect(divideRoundHalfEven(dividend, divisor)).toBe(expected);
  });

  it('refuses a zero or negative divisor', () => {
    expect(() => divideRoundHalfEven(1n, 0n)).toThrow(RangeError);
    expect(() => divideRoundHalfEven(1n, -1n)).toThrow(RangeError);
  });
});

describe('formatFxRatio', () => {
  it('formats an exact decimal without trailing zeros', () => {
    expect(formatFxRatio(parseFxRate('4.3768000000'), 10)).toBe('4.3768');
    expect(formatFxRatio(parseFxRate('48'), 10)).toBe('48');
  });

  it('formats an inverse to the requested digits, half to even', () => {
    // 1 / 4.3768 = 0.228477426... → 0.2284774264 at 10 digits
    expect(formatFxRatio(invertFxRatio(parseFxRate('4.3768')), 10)).toBe('0.2284774264');
    // 1 / 8 = 0.125 → 0.12 at 2 digits (half to even)
    expect(formatFxRatio(invertFxRatio(parseFxRate('8')), 2)).toBe('0.12');
    // 3 / 8 = 0.375 → 0.38
    expect(formatFxRatio(divideFxRatios(parseFxRate('3'), parseFxRate('8')), 2)).toBe('0.38');
  });

  it('pads small values with leading zeros', () => {
    expect(formatFxRatio(parseFxRate('0.0005'), 4)).toBe('0.0005');
    expect(formatFxRatio(parseFxRate('0.00004'), 4)).toBe('0');
  });

  it('rejects negative digits', () => {
    expect(() => formatFxRatio(parseFxRate('1'), -1)).toThrow(RangeError);
  });
});
