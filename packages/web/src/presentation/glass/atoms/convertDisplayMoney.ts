import {
  InvalidFxRateError,
  ONE_FX_RATIO,
  divideFxRatios,
  divideRoundHalfEven,
  formatFxRatio,
  getMinorUnitExponent,
  parseFxRate,
  type FxRatio,
  type MinorUnitAmount,
} from '@power-budget/core';
import type { FxRateTable } from '../../../infrastructure/fx/FxRateCache.js';

const EXPONENT_NOTATION = /e/i;
const PLAIN_DECIMAL_DIGITS = 12;
const RATE_TOOLTIP_DIGITS = 4;

/**
 * Exact `1 from = ratio to` from a table of rates against its base currency, or null
 * when a currency is missing. The table keeps rates as JS numbers; each is turned into
 * its shortest decimal string and from there on only bigint maths is used.
 */
export function displayFxRatio(from: string, to: string, table: FxRateTable): FxRatio | null {
  const fromPerBase = ratePerBase(from, table);
  const toPerBase = ratePerBase(to, table);
  if (fromPerBase === null || toPerBase === null) {
    return null;
  }

  return divideFxRatios(toPerBase, fromPerBase);
}

/** Converts in integer minor units with one final half-to-even rounding; no floats. */
export function convertDisplayMoney(
  amount: MinorUnitAmount,
  targetCurrency: string,
  table: FxRateTable,
): MinorUnitAmount | null {
  const ratio = displayFxRatio(amount.currency, targetCurrency, table);
  if (ratio === null) {
    return null;
  }
  const sourceScale = 10n ** BigInt(getMinorUnitExponent(amount.currency));
  const targetScale = 10n ** BigInt(getMinorUnitExponent(targetCurrency));
  const amountMinor = divideRoundHalfEven(
    amount.amountMinor * ratio.numerator * targetScale,
    ratio.denominator * sourceScale,
  );

  return { amountMinor, currency: targetCurrency };
}

export function formatDisplayRate(ratio: FxRatio): string {
  return formatFxRatio(ratio, RATE_TOOLTIP_DIGITS);
}

function ratePerBase(currency: string, table: FxRateTable): FxRatio | null {
  if (currency === table.baseCurrency) {
    return ONE_FX_RATIO;
  }
  const rate = table.rates[currency];
  if (rate === undefined) {
    return null;
  }

  return parseRate(rate);
}

function parseRate(rate: number): FxRatio | null {
  const text = EXPONENT_NOTATION.test(String(rate))
    ? rate.toFixed(PLAIN_DECIMAL_DIGITS)
    : String(rate);
  try {
    return parseFxRate(text);
  } catch (error) {
    if (error instanceof InvalidFxRateError) {
      return null;
    }
    throw error;
  }
}
