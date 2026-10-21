import { IsoDateTime, isSupportedCurrency, parseFxRate } from '@power-budget/core';
import type { IsoDate } from '@power-budget/core';
import type { FxRateProvider, NewFxRate } from '../../domain/fx/index.js';
import type { FxClock, FxHttpFetch } from './fx-http.js';
import { FX_HTTP_TIMEOUT_MS } from './fx-http.js';

const ECB_HIST_90D_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
const ECB_HIST_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml';
/** Dates older than this are read from the full history file instead of the 90-day one. */
const HIST_90D_SAFE_DAYS = 85;
const ONE_DAY_MS = 86_400_000;
const RATE_PATTERN = /<Cube\s+currency="([A-Z]{3})"\s+rate="([^"]+)"\s*\/>/g;

/**
 * ECB euro foreign exchange reference rates (`1 EUR = rate x`). Reads the
 * history XML and picks the cube of the requested date, so a catch-up run for
 * an earlier day stores that day's rates, not today's. ECB does not publish on
 * weekends and TARGET holidays: no cube for the date means an empty result.
 * ECB publishes no UAH (and no RUB since 2022); the fallback provider covers it.
 */
export class EcbFxRateProvider implements FxRateProvider {
  constructor(
    private readonly httpFetch: FxHttpFetch,
    private readonly clock: FxClock,
  ) {}

  async fetchForDate(date: IsoDate): Promise<NewFxRate[]> {
    const xml = await this.fetchXml(this.urlFor(date));

    return EcbFxRateProvider.parse(xml, date, IsoDateTime.of(this.clock().toISOString()));
  }

  /** Rates of the cube dated exactly `date`; empty when the file has no such cube. */
  static parse(xml: string, date: IsoDate, fetchedAt: IsoDateTime): NewFxRate[] {
    const cubeStart = xml.indexOf(`<Cube time="${date}">`);
    if (cubeStart === -1) {
      return [];
    }
    const cubeEnd = xml.indexOf('</Cube>', cubeStart);
    const cube = xml.slice(cubeStart, cubeEnd === -1 ? xml.length : cubeEnd);
    const rates: NewFxRate[] = [];
    for (const match of cube.matchAll(RATE_PATTERN)) {
      const [, currency, rate] = match;
      if (currency === undefined || rate === undefined || !isSupportedCurrency(currency)) {
        continue;
      }
      parseFxRate(rate); // throws InvalidFxRateError on a zero or malformed rate
      rates.push({
        baseCurrency: 'EUR',
        quoteCurrency: currency,
        rate,
        rateDate: date,
        source: 'ecb',
        fetchedAt,
      });
    }

    return rates;
  }

  private urlFor(date: IsoDate): string {
    const ageDays = (this.clock().getTime() - Date.parse(`${date}T00:00:00.000Z`)) / ONE_DAY_MS;

    return ageDays > HIST_90D_SAFE_DAYS ? ECB_HIST_URL : ECB_HIST_90D_URL;
  }

  private async fetchXml(url: string): Promise<string> {
    const response = await this.httpFetch(url, {
      headers: { accept: 'application/xml' },
      signal: AbortSignal.timeout(FX_HTTP_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`ECB fetch failed with status ${response.status}`);
    }

    return response.text();
  }
}
