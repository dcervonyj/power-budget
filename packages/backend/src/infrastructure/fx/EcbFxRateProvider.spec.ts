import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IsoDate, IsoDateTime } from '@power-budget/core';
import { EcbFxRateProvider } from './EcbFxRateProvider.js';
import type { FxHttpFetch } from './fx-http.js';

const HIST_XML = readFileSync(join(__dirname, '__fixtures__/ecb-hist-90d.xml'), 'utf-8');
const NOW = new Date('2026-10-21T15:00:00.000Z');
const FETCHED_AT = IsoDateTime.of('2026-10-21T15:00:00.000Z');

function fetchReturning(body: string, status = 200): ReturnType<typeof vi.fn<FxHttpFetch>> {
  return vi
    .fn<FxHttpFetch>()
    .mockImplementation(() => Promise.resolve(new Response(body, { status })));
}

function clock(): Date {
  return NOW;
}

describe('EcbFxRateProvider', () => {
  it('returns the EUR rates of the requested date as decimal strings', async () => {
    const provider = new EcbFxRateProvider(fetchReturning(HIST_XML), clock);

    const rates = await provider.fetchForDate(IsoDate.of('2026-10-19'));

    expect(rates.map((rate) => [rate.baseCurrency, rate.quoteCurrency])).toEqual(
      ['USD', 'CZK', 'DKK', 'GBP', 'PLN', 'SEK', 'CHF', 'NOK'].map((quote) => ['EUR', quote]),
    );
    expect(rates.find((r) => r.quoteCurrency === 'PLN')).toEqual({
      baseCurrency: 'EUR',
      quoteCurrency: 'PLN',
      rate: '4.3713',
      rateDate: '2026-10-19',
      source: 'ecb',
      fetchedAt: FETCHED_AT,
    });
    expect(rates.find((r) => r.quoteCurrency === 'GBP')?.rate).toBe('0.84205');
  });

  it('keeps the exact published digits (no float round trip)', async () => {
    const provider = new EcbFxRateProvider(fetchReturning(HIST_XML), clock);

    const rates = await provider.fetchForDate(IsoDate.of('2026-10-16'));

    expect(rates.find((r) => r.quoteCurrency === 'PLN')?.rate).toBe('4.37');
    expect(rates.find((r) => r.quoteCurrency === 'NOK')?.rate).toBe('10.624');
  });

  it('skips currencies the app does not support (JPY)', async () => {
    const provider = new EcbFxRateProvider(fetchReturning(HIST_XML), clock);

    const rates = await provider.fetchForDate(IsoDate.of('2026-10-20'));

    expect(rates.some((r) => String(r.quoteCurrency) === 'JPY')).toBe(false);
    expect(rates).toHaveLength(8);
  });

  it('returns nothing for a day without a publication (weekend)', async () => {
    const provider = new EcbFxRateProvider(fetchReturning(HIST_XML), clock);

    expect(await provider.fetchForDate(IsoDate.of('2026-10-18'))).toEqual([]);
  });

  it('reads the 90-day history for recent dates and the full history for older ones', async () => {
    const httpFetch = fetchReturning(HIST_XML);
    const provider = new EcbFxRateProvider(httpFetch, clock);

    await provider.fetchForDate(IsoDate.of('2026-10-20'));
    await provider.fetchForDate(IsoDate.of('2026-05-04'));

    expect(httpFetch.mock.calls.map(([url]) => url)).toEqual([
      'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml',
      'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml',
    ]);
  });

  it('throws on a non-OK response', async () => {
    const provider = new EcbFxRateProvider(fetchReturning('', 503), clock);

    await expect(provider.fetchForDate(IsoDate.of('2026-10-20'))).rejects.toThrow(
      'ECB fetch failed with status 503',
    );
  });

  it('rejects a zero rate instead of storing it', () => {
    const xml = '<Cube time="2026-10-20"><Cube currency="PLN" rate="0"/></Cube>';

    expect(() => EcbFxRateProvider.parse(xml, IsoDate.of('2026-10-20'), FETCHED_AT)).toThrow(
      'Invalid FX rate "0"',
    );
  });
});
