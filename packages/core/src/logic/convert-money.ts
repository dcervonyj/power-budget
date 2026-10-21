import type { Money } from '../domain/shared/money.js';
import type { CurrencyCode } from '../domain/shared/currency.js';
import { CURRENCIES } from '../domain/shared/currency.js';
import type { FxRateTable } from '../domain/currency/entities.js';
import type { FxRatio } from './fx-ratio.js';
import {
  ONE_FX_RATIO,
  divideRoundHalfEven,
  invertFxRatio,
  multiplyFxRatios,
  parseFxRate,
} from './fx-ratio.js';

/** Every provider publishes against EUR, so cross rates pivot through it. */
export const FX_PIVOT_CURRENCY: CurrencyCode = 'EUR';

export class UnknownCurrencyPairError extends Error {
  constructor(from: CurrencyCode, to: CurrencyCode) {
    super(`No FX rate for ${from}/${to} (no direct, inverse, or EUR cross-rate)`);
    this.name = 'UnknownCurrencyPairError';
  }
}

/**
 * Exact rate for `1 from = rate to`, looked up in this order: direct row,
 * inverse row, then a pivot through EUR where each leg may itself be direct
 * or inverse. Returns null when no path exists. Throws InvalidFxRateError on
 * a malformed or zero rate instead of dividing by it.
 */
export function resolveFxRate(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: FxRateTable,
): FxRatio | null {
  if (from === to) {
    return ONE_FX_RATIO;
  }
  const single = lookupPair(from, to, rates);
  if (single !== null) {
    return single;
  }
  if (from === FX_PIVOT_CURRENCY || to === FX_PIVOT_CURRENCY) {
    return null;
  }
  const toPivot = lookupPair(from, FX_PIVOT_CURRENCY, rates);
  const fromPivot = lookupPair(FX_PIVOT_CURRENCY, to, rates);
  if (toPivot === null || fromPivot === null) {
    return null;
  }

  return multiplyFxRatios(toPivot, fromPivot);
}

/**
 * Converts money to targetCurrency with a FxRateTable snapshot. Exact bigint
 * arithmetic, minor-unit exponents honoured, one final half-to-even rounding.
 * Throws UnknownCurrencyPairError when no rate path is found.
 */
export function convertMoney(
  money: Money,
  targetCurrency: CurrencyCode,
  rates: FxRateTable,
): Money {
  if (money.currency === targetCurrency) {
    return money;
  }
  const rate = resolveFxRate(money.currency, targetCurrency, rates);
  if (rate === null) {
    throw new UnknownCurrencyPairError(money.currency, targetCurrency);
  }
  const sourceScale = 10n ** BigInt(CURRENCIES[money.currency].minorUnitExponent);
  const targetScale = 10n ** BigInt(CURRENCIES[targetCurrency].minorUnitExponent);
  const amountMinor = divideRoundHalfEven(
    money.amountMinor * rate.numerator * targetScale,
    rate.denominator * sourceScale,
  );

  return { amountMinor, currency: targetCurrency };
}

function lookupPair(from: CurrencyCode, to: CurrencyCode, rates: FxRateTable): FxRatio | null {
  const direct = rates.get(`${from}/${to}`);
  if (direct !== undefined) {
    return parseFxRate(direct.rate);
  }
  const inverse = rates.get(`${to}/${from}`);
  if (inverse !== undefined) {
    return invertFxRatio(parseFxRate(inverse.rate));
  }

  return null;
}
