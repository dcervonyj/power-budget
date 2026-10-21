import {
  IsoDateTime,
  divideFxRatios,
  formatFxRatio,
  isSupportedCurrency,
  parseFxRate,
} from '@power-budget/core';
import type { CurrencyCode, FxRatio, IsoDate } from '@power-budget/core';
import type { FxRateProvider, NewFxRate } from '../../domain/fx/index.js';
import { FX_RATE_FRACTION_DIGITS } from '../../domain/fx/index.js';
import type { FxClock, FxHttpFetch } from './fx-http.js';
import { FX_HTTP_TIMEOUT_MS } from './fx-http.js';

const NBP_TABLE_A_URL = 'https://api.nbp.pl/api/exchangerates/tables/A';
const RATE_PATTERN = /<Rate>[\s\S]*?<Code>([A-Z]{3})<\/Code>\s*<Mid>([^<]+)<\/Mid>\s*<\/Rate>/g;
const EFFECTIVE_DATE_PATTERN = /<EffectiveDate>(\d{4}-\d{2}-\d{2})<\/EffectiveDate>/;

/**
 * National Bank of Poland table A: mid rates in PLN for ~32 currencies,
 * including EUR, USD, GBP, CHF and UAH (verified 2026-10-21; ECB and
 * Frankfurter, which mirrors ECB, publish no UAH). Free, no API key.
 * Rows are re-based on EUR (`1 EUR = EUR_mid / x_mid x`, exact decimal maths,
 * rounded half to even to 10 digits) so the table keeps one pivot currency.
 * The API answers 404 on days without a table (weekends, Polish holidays).
 */
export class NbpFxRateProvider implements FxRateProvider {
  constructor(
    private readonly httpFetch: FxHttpFetch,
    private readonly clock: FxClock,
  ) {}

  async fetchForDate(date: IsoDate): Promise<NewFxRate[]> {
    const response = await this.httpFetch(`${NBP_TABLE_A_URL}/${date}/?format=xml`, {
      headers: { accept: 'application/xml' },
      signal: AbortSignal.timeout(FX_HTTP_TIMEOUT_MS),
    });
    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      throw new Error(`NBP fetch failed with status ${response.status}`);
    }

    return NbpFxRateProvider.parse(
      await response.text(),
      date,
      IsoDateTime.of(this.clock().toISOString()),
    );
  }

  /** EUR-based rows of the table effective on exactly `date`; empty for another date. */
  static parse(xml: string, date: IsoDate, fetchedAt: IsoDateTime): NewFxRate[] {
    if (EFFECTIVE_DATE_PATTERN.exec(xml)?.[1] !== date) {
      return [];
    }
    const plnPerUnit = NbpFxRateProvider.extractMidRates(xml);
    const eurInPln = plnPerUnit.get('EUR');
    if (eurInPln === undefined) {
      throw new Error(`NBP table A for ${date} has no EUR rate`);
    }
    const rates: NewFxRate[] = [NbpFxRateProvider.row('PLN', eurInPln, date, fetchedAt)];
    for (const [currency, mid] of plnPerUnit) {
      if (currency === 'EUR') {
        continue;
      }
      rates.push(NbpFxRateProvider.row(currency, divideFxRatios(eurInPln, mid), date, fetchedAt));
    }

    return rates;
  }

  private static extractMidRates(xml: string): Map<CurrencyCode, FxRatio> {
    const mids = new Map<CurrencyCode, FxRatio>();
    for (const match of xml.matchAll(RATE_PATTERN)) {
      const [, code, mid] = match;
      if (code === undefined || mid === undefined || !isSupportedCurrency(code)) {
        continue;
      }
      mids.set(code, parseFxRate(mid));
    }

    return mids;
  }

  private static row(
    quote: CurrencyCode,
    eurToQuote: FxRatio,
    date: IsoDate,
    fetchedAt: IsoDateTime,
  ): NewFxRate {
    return {
      baseCurrency: 'EUR',
      quoteCurrency: quote,
      rate: formatFxRatio(eurToQuote, FX_RATE_FRACTION_DIGITS),
      rateDate: date,
      source: 'nbp',
      fetchedAt,
    };
  }
}
