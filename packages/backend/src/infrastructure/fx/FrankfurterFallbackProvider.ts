import { IsoDate, IsoDateTime, isSupportedCurrency } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';
import type { FxRateProvider, NewFxRate } from '../../domain/fx/index.js';

const RATE_PRECISION = 1_000_000n;

interface FrankfurterResponse {
  readonly date: string;
  readonly rates: Readonly<Record<string, number>>;
}

export class FrankfurterFallbackProvider implements FxRateProvider {
  async fetchForDate(date: Date): Promise<NewFxRate[]> {
    const dateStr = date.toISOString().slice(0, 10);
    const url = `https://api.frankfurter.app/${dateStr}?from=EUR`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Frankfurter fetch failed with status ${response.status}`);
    }
    const json = (await response.json()) as FrankfurterResponse;
    const fetchedAt = IsoDateTime.of(date.toISOString());
    const rateOnDate = IsoDate.of(json.date);

    return this.buildRates(json.rates, rateOnDate, fetchedAt);
  }

  private buildRates(
    rawRates: Readonly<Record<string, number>>,
    rateOnDate: IsoDate,
    fetchedAt: IsoDateTime,
  ): NewFxRate[] {
    const pairs: NewFxRate[] = [];

    for (const [currencyStr, rate] of Object.entries(rawRates)) {
      if (!isSupportedCurrency(currencyStr)) {
        continue;
      }
      const quote: CurrencyCode = currencyStr;

      pairs.push({
        base: 'EUR',
        quote,
        rateMinorUnits: BigInt(Math.round(rate * Number(RATE_PRECISION))),
        rateOnDate,
        source: 'FRANKFURTER',
        fetchedAt,
      });
    }

    return pairs;
  }
}
