import { IsoDate, IsoDateTime, isSupportedCurrency } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';
import type { FxRateProvider, NewFxRate } from '../domain/index.js';

const RATE_PRECISION = 1_000_000n;
const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export class EcbFxRateProvider implements FxRateProvider {
  async fetchForDate(date: Date): Promise<NewFxRate[]> {
    const xml = await this.fetchXml();
    const fetchedAt = IsoDateTime.of(date.toISOString());
    const eurRates = this.extractEurRates(xml);
    const rateOnDate = this.extractDate(xml);

    return this.deriveAllPairs(eurRates, rateOnDate, fetchedAt);
  }

  private async fetchXml(): Promise<string> {
    const response = await fetch(ECB_URL);
    if (!response.ok) {
      throw new Error(`ECB fetch failed with status ${response.status}`);
    }

    return response.text();
  }

  private extractDate(xml: string): IsoDate {
    const match = xml.match(/<Cube time="(\d{4}-\d{2}-\d{2})"/);
    if (match === null) {
      throw new Error('ECB XML: missing time attribute on Cube element');
    }
    const datePart = match[1];
    if (datePart === undefined) {
      throw new Error('ECB XML: time attribute capture group missing');
    }

    return IsoDate.of(datePart);
  }

  private extractEurRates(xml: string): ReadonlyMap<CurrencyCode, number> {
    const eurRates = new Map<CurrencyCode, number>();
    const pairRegex = /<Cube currency="([A-Z]+)" rate="([\d.]+)"/g;

    let match: RegExpExecArray | null;
    while ((match = pairRegex.exec(xml)) !== null) {
      const currencyStr = match[1];
      const rateStr = match[2];
      if (currencyStr === undefined || rateStr === undefined) {
        continue;
      }
      if (!isSupportedCurrency(currencyStr)) {
        continue;
      }
      eurRates.set(currencyStr, parseFloat(rateStr));
    }

    return eurRates;
  }

  private deriveAllPairs(
    eurRates: ReadonlyMap<CurrencyCode, number>,
    rateOnDate: IsoDate,
    fetchedAt: IsoDateTime,
  ): NewFxRate[] {
    const quoteCurrencies = Array.from(eurRates.keys());
    const allCurrencies: CurrencyCode[] = ['EUR', ...quoteCurrencies];
    const allRatesFromEur = new Map<CurrencyCode, number>([['EUR', 1.0], ...eurRates]);

    const pairs: NewFxRate[] = [];

    for (const base of allCurrencies) {
      for (const quote of allCurrencies) {
        if (base === quote) {
          continue;
        }
        const baseRate = EcbFxRateProvider.getEurRate(allRatesFromEur, base);
        const quoteRate = EcbFxRateProvider.getEurRate(allRatesFromEur, quote);
        // cross-rate: 1 base = (quoteRate / baseRate) quote
        const crossRate = quoteRate / baseRate;

        pairs.push({
          base,
          quote,
          rateMinorUnits: BigInt(Math.round(crossRate * Number(RATE_PRECISION))),
          rateOnDate,
          source: 'ECB',
          fetchedAt,
        });
      }
    }

    return pairs;
  }

  private static getEurRate(
    rates: ReadonlyMap<CurrencyCode, number>,
    currency: CurrencyCode,
  ): number {
    const rate = rates.get(currency);
    if (rate === undefined) {
      throw new Error(`EcbFxRateProvider: missing EUR rate for ${currency}`);
    }

    return rate;
  }
}
