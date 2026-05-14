import type { Money } from '../domain/shared/money.js';
import type { CurrencyCode } from '../domain/shared/currency.js';
import type { FxRateTable } from '../domain/currency/entities.js';

export class UnknownCurrencyPairError extends Error {
  constructor(from: CurrencyCode, to: CurrencyCode) {
    super(`No FX rate for ${from}/${to}`);
    this.name = 'UnknownCurrencyPairError';
  }
}

/**
 * Convert money to targetCurrency using the provided FxRateTable snapshot.
 * Uses bigint arithmetic scaled by 1_000_000 to avoid floating-point error.
 * For cross-rates, pivots through EUR if a direct or inverse pair is absent.
 */
export function convertMoney(
  money: Money,
  targetCurrency: CurrencyCode,
  rates: FxRateTable,
): Money {
  if (money.currency === targetCurrency) return money;

  // Direct pair
  const directKey = `${money.currency}/${targetCurrency}`;
  const direct = rates.get(directKey);
  if (direct) {
    const rateScaled = BigInt(Math.round(direct.rate * 1_000_000));
    return { amountMinor: (money.amountMinor * rateScaled) / 1_000_000n, currency: targetCurrency };
  }

  // Inverse pair
  const inverseKey = `${targetCurrency}/${money.currency}`;
  const inverse = rates.get(inverseKey);
  if (inverse) {
    const rateScaled = BigInt(Math.round(inverse.rate * 1_000_000));
    return { amountMinor: (money.amountMinor * 1_000_000n) / rateScaled, currency: targetCurrency };
  }

  // Cross-rate via EUR pivot
  const toEurKey = `${money.currency}/EUR`;
  const fromEurKey = `EUR/${targetCurrency}`;
  const toEur = rates.get(toEurKey);
  const fromEur = rates.get(fromEurKey);
  if (toEur && fromEur) {
    const toEurScaled = BigInt(Math.round(toEur.rate * 1_000_000));
    const fromEurScaled = BigInt(Math.round(fromEur.rate * 1_000_000));
    const inEur = (money.amountMinor * toEurScaled) / 1_000_000n;
    return { amountMinor: (inEur * fromEurScaled) / 1_000_000n, currency: targetCurrency };
  }

  throw new UnknownCurrencyPairError(money.currency, targetCurrency);
}
