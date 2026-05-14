import type { Money } from '../domain/shared/money.js';
import type { CurrencyCode } from '../domain/shared/currency.js';
import type { FxRateTable } from '../domain/currency/entities.js';

export class UnknownCurrencyPairError extends Error {
  constructor(from: CurrencyCode, to: CurrencyCode) {
    super(`No FX rate for ${from}/${to} (no direct, inverse, or EUR cross-rate)`);
    this.name = 'UnknownCurrencyPairError';
  }
}

/**
 * Convert money to targetCurrency using a FxRateTable snapshot.
 * Uses bigint arithmetic scaled by 1_000_000 to avoid floating-point errors.
 * Falls back to EUR cross-rate pivot when direct pair is absent.
 * Throws UnknownCurrencyPairError when no path is found.
 */
export function convertMoney(
  money: Money,
  targetCurrency: CurrencyCode,
  rates: FxRateTable,
): Money {
  if (money.currency === targetCurrency) return money;

  const SCALE = 1_000_000n;

  // Direct pair: base → quote
  const directKey = `${money.currency}/${targetCurrency}`;
  const direct = rates.get(directKey);
  if (direct) {
    const rateScaled = BigInt(Math.round(direct.rate * Number(SCALE)));
    return { amountMinor: (money.amountMinor * rateScaled) / SCALE, currency: targetCurrency };
  }

  // Inverse pair: quote → base (rate = 1/r)
  const inverseKey = `${targetCurrency}/${money.currency}`;
  const inverse = rates.get(inverseKey);
  if (inverse) {
    const rateScaled = BigInt(Math.round(inverse.rate * Number(SCALE)));
    return { amountMinor: (money.amountMinor * SCALE) / rateScaled, currency: targetCurrency };
  }

  // EUR cross-rate pivot: base → EUR → target
  const toEurKey = `${money.currency}/EUR`;
  const fromEurKey = `EUR/${targetCurrency}`;
  const toEur = rates.get(toEurKey);
  const fromEur = rates.get(fromEurKey);
  if (toEur && fromEur) {
    const toEurScaled = BigInt(Math.round(toEur.rate * Number(SCALE)));
    const fromEurScaled = BigInt(Math.round(fromEur.rate * Number(SCALE)));
    const inEurMinor = (money.amountMinor * toEurScaled) / SCALE;
    return { amountMinor: (inEurMinor * fromEurScaled) / SCALE, currency: targetCurrency };
  }

  throw new UnknownCurrencyPairError(money.currency, targetCurrency);
}
