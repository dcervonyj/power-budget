import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FxRateId, IsoDate, IsoDateTime, convertMoney } from '@power-budget/core';
import type { FxRate, FxRateTable } from '@power-budget/core';
import { NbpFxRateProvider } from './NbpFxRateProvider.js';
import type { FxHttpFetch } from './fx-http.js';

const TABLE_XML = readFileSync(join(__dirname, '__fixtures__/nbp-table-a-2026-10-20.xml'), 'utf-8');
const NOW = new Date('2026-10-21T15:00:00.000Z');
const DATE = IsoDate.of('2026-10-20');

function fetchReturning(body: string, status = 200): ReturnType<typeof vi.fn<FxHttpFetch>> {
  return vi
    .fn<FxHttpFetch>()
    .mockImplementation(() => Promise.resolve(new Response(body, { status })));
}

function clock(): Date {
  return NOW;
}

describe('NbpFxRateProvider', () => {
  it('requests table A for the exact date', async () => {
    const httpFetch = fetchReturning(TABLE_XML);

    await new NbpFxRateProvider(httpFetch, clock).fetchForDate(DATE);

    expect(httpFetch.mock.calls[0]?.[0]).toBe(
      'https://api.nbp.pl/api/exchangerates/tables/A/2026-10-20/?format=xml',
    );
  });

  it('re-bases PLN mid rates on EUR with exact decimal division', async () => {
    const rates = await new NbpFxRateProvider(fetchReturning(TABLE_XML), clock).fetchForDate(DATE);

    expect(rates.map((r) => [r.quoteCurrency, r.rate])).toEqual([
      ['PLN', '4.3716'], // EUR mid
      ['USD', '1.1221027234'], // 4.3716 / 3.8959
      ['CHF', '0.9256569335'], // 4.3716 / 4.7227
      ['GBP', '0.840643809'], // 4.3716 / 5.2003
      ['UAH', '50.5972222222'], // 4.3716 / 0.0864
      ['CZK', '24.3136818687'], // 4.3716 / 0.1798
    ]);
    expect(rates[0]).toEqual({
      baseCurrency: 'EUR',
      quoteCurrency: 'PLN',
      rate: '4.3716',
      rateDate: '2026-10-20',
      source: 'nbp',
      fetchedAt: IsoDateTime.of('2026-10-21T15:00:00.000Z'),
    });
  });

  it('lets core convert UAH to PLN consistently with the NBP mid rate', async () => {
    const rates = await new NbpFxRateProvider(fetchReturning(TABLE_XML), clock).fetchForDate(DATE);
    const table: FxRateTable = new Map(
      rates.map((r): [string, FxRate] => [
        `${r.baseCurrency}/${r.quoteCurrency}`,
        { ...r, id: FxRateId.of('01936d3e-8000-7000-a000-000000000001') },
      ]),
    );

    // 1000.00 UAH × 0.0864 = 86.40 PLN
    expect(convertMoney({ amountMinor: 100_000n, currency: 'UAH' }, 'PLN', table).amountMinor).toBe(
      8_640n,
    );
  });

  it('returns nothing on 404 (no table on weekends and Polish holidays)', async () => {
    const provider = new NbpFxRateProvider(
      fetchReturning('404 NotFound - Brak danych', 404),
      clock,
    );

    expect(await provider.fetchForDate(IsoDate.of('2026-10-18'))).toEqual([]);
  });

  it('returns nothing when the table is effective on another date', () => {
    expect(
      NbpFxRateProvider.parse(
        TABLE_XML,
        IsoDate.of('2026-10-19'),
        IsoDateTime.of(NOW.toISOString()),
      ),
    ).toEqual([]);
  });

  it('throws on a server error', async () => {
    const provider = new NbpFxRateProvider(fetchReturning('', 500), clock);

    await expect(provider.fetchForDate(DATE)).rejects.toThrow('NBP fetch failed with status 500');
  });
});
