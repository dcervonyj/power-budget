/**
 * Exact decimal arithmetic for FX rates. A rate travels as a decimal string
 * (`"4.2734"`) from the provider to the database and back; inside pure logic
 * it is a ratio of two bigints, so chaining an inverse or a pivot never loses
 * precision. Rounding happens once, at the very end, half to even.
 */

/** A positive rational number: `numerator / denominator`, both > 0. */
export interface FxRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export class InvalidFxRateError extends Error {
  constructor(value: string) {
    super(`Invalid FX rate "${value}": expected a positive decimal string such as "4.2734"`);
    this.name = 'InvalidFxRateError';
  }
}

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

export const ONE_FX_RATIO: FxRatio = { numerator: 1n, denominator: 1n };

/** Parses a positive decimal string. Zero, negatives, exponents and junk throw. */
export function parseFxRate(value: string): FxRatio {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (match === null) {
    throw new InvalidFxRateError(value);
  }
  const integerPart = match[1] ?? '0';
  const fractionPart = match[2] ?? '';
  const numerator = BigInt(integerPart + fractionPart);
  if (numerator === 0n) {
    throw new InvalidFxRateError(value);
  }

  return { numerator, denominator: 10n ** BigInt(fractionPart.length) };
}

export function invertFxRatio(ratio: FxRatio): FxRatio {
  return { numerator: ratio.denominator, denominator: ratio.numerator };
}

export function multiplyFxRatios(a: FxRatio, b: FxRatio): FxRatio {
  return {
    numerator: a.numerator * b.numerator,
    denominator: a.denominator * b.denominator,
  };
}

/** `a / b` */
export function divideFxRatios(a: FxRatio, b: FxRatio): FxRatio {
  return multiplyFxRatios(a, invertFxRatio(b));
}

/**
 * Integer division rounded half to even (banker's rounding), symmetric for
 * negative dividends so a refund converts to the exact negative of the charge.
 */
export function divideRoundHalfEven(dividend: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) {
    throw new RangeError('divideRoundHalfEven: divisor must be positive');
  }
  const negative = dividend < 0n;
  const magnitude = negative ? -dividend : dividend;
  const truncated = magnitude / divisor;
  const twiceRemainder = (magnitude % divisor) * 2n;
  const roundUp = twiceRemainder > divisor || (twiceRemainder === divisor && truncated % 2n === 1n);
  const quotient = roundUp ? truncated + 1n : truncated;

  return negative ? -quotient : quotient;
}

/**
 * Formats a ratio as a decimal string with at most `fractionDigits` digits,
 * rounded half to even, trailing zeros removed (`"0.2284"`, `"48.25"`).
 */
export function formatFxRatio(ratio: FxRatio, fractionDigits: number): string {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) {
    throw new RangeError('formatFxRatio: fractionDigits must be a non-negative integer');
  }
  const scale = 10n ** BigInt(fractionDigits);
  const scaled = divideRoundHalfEven(ratio.numerator * scale, ratio.denominator);
  const digits = scaled.toString().padStart(fractionDigits + 1, '0');
  const integerPart = digits.slice(0, digits.length - fractionDigits);
  const fractionPart = digits.slice(digits.length - fractionDigits).replace(/0+$/, '');

  return fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
}
