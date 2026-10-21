import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { IsoDate, IsoDateTime } from '@power-budget/core';
import type { CurrencyCode, FxRateSource } from '@power-budget/core';
import { startContainers, stopContainers, resetState, getDb } from './setup.js';
import { createTestApp } from './app.js';
import { DrizzleFxRateRepository } from '../../infrastructure/fx/DrizzleFxRateRepository.js';
import { EcbFxRateProvider } from '../../infrastructure/fx/EcbFxRateProvider.js';
import { NbpFxRateProvider } from '../../infrastructure/fx/NbpFxRateProvider.js';
import { IngestDailyFxRatesUseCase } from '../../application/fx/use-cases/IngestDailyFxRatesUseCase.js';
import type { NewFxRate } from '../../domain/fx/index.js';

const FIXTURES = path.resolve(process.cwd(), 'src/infrastructure/fx/__fixtures__');
const ECB_XML = readFileSync(path.join(FIXTURES, 'ecb-hist-90d.xml'), 'utf-8');
const NBP_XML = readFileSync(path.join(FIXTURES, 'nbp-table-a-2026-10-20.xml'), 'utf-8');
const FETCHED_AT = IsoDateTime.of('2026-10-21T15:00:00.000Z');

function rate(
  quote: CurrencyCode,
  value: string,
  date: string,
  source: FxRateSource = 'ecb',
): NewFxRate {
  return {
    baseCurrency: 'EUR',
    quoteCurrency: quote,
    rate: value,
    rateDate: IsoDate.of(date),
    source,
    fetchedAt: FETCHED_AT,
  };
}

function clock(): Date {
  return new Date('2026-10-21T15:00:00.000Z');
}

function fixtureFetch(body: string): (url: string) => Promise<Response> {
  return (url: string) =>
    Promise.resolve(
      url.includes('/2026-10-20/') || !url.includes('nbp')
        ? new Response(body, { status: 200 })
        : new Response('404 NotFound - Brak danych', { status: 404 }),
    );
}

describe('FX rates: repository, ingest and GET /fx-rates against Postgres', () => {
  let app: NestFastifyApplication;
  let repo: DrizzleFxRateRepository;

  beforeAll(async () => {
    await startContainers();
    app = await createTestApp();
    repo = new DrizzleFxRateRepository(getDb());
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await app?.close();
    await stopContainers();
  });

  async function accessToken(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: `fx-${Date.now()}@example.com`, password: 'Str0ngPass!' },
    });

    return res.json<{ accessToken: string }>().accessToken;
  }

  describe('DrizzleFxRateRepository', () => {
    it('round-trips decimal strings exactly and keeps the first row per (pair, date)', async () => {
      expect(await repo.saveBatch([rate('PLN', '4.3768', '2026-10-20')])).toBe(1);
      expect(await repo.saveBatch([rate('PLN', '9.99', '2026-10-20', 'nbp')])).toBe(0);

      const stored = await repo.getRate('EUR', 'PLN', IsoDate.of('2026-10-20'));

      expect(stored).toMatchObject({ rate: '4.3768', source: 'ecb', rateDate: '2026-10-20' });
      expect(typeof stored?.rate).toBe('string');
    });

    it('stores a 10-digit derived rate without loss', async () => {
      await repo.saveBatch([rate('UAH', '50.5972222222', '2026-10-20', 'nbp')]);

      expect((await repo.getRate('EUR', 'UAH', IsoDate.of('2026-10-20')))?.rate).toBe(
        '50.5972222222',
      );
    });

    it('getTable returns the latest rate per pair within the carry-forward window', async () => {
      await repo.saveBatch([
        rate('PLN', '4.37', '2026-10-16'),
        rate('PLN', '4.3768', '2026-10-20'),
        rate('USD', '1.1253', '2026-10-16'),
        rate('GBP', '0.9', '2026-10-01'),
        rate('CHF', '0.92', '2026-10-25'),
      ]);

      const table = await repo.getTable(IsoDate.of('2026-10-21'), 7);

      expect(new Map([...table].map(([key, value]) => [key, value.rate]))).toEqual(
        new Map([
          ['EUR/PLN', '4.3768'],
          ['EUR/USD', '1.1253'],
        ]),
      );
    });

    it('lists the quote currencies stored for an exact date', async () => {
      await repo.saveBatch([
        rate('PLN', '4.3768', '2026-10-20'),
        rate('USD', '1.1225', '2026-10-19'),
      ]);

      expect(await repo.listQuoteCurrencies('EUR', IsoDate.of('2026-10-20'))).toEqual(['PLN']);
    });
  });

  describe('IngestDailyFxRatesUseCase with fixture HTTP', () => {
    it('stores ECB rates plus NBP UAH, then a re-run stores nothing', async () => {
      const ingest = new IngestDailyFxRatesUseCase(
        new EcbFxRateProvider(fixtureFetch(ECB_XML), clock),
        new NbpFxRateProvider(fixtureFetch(NBP_XML), clock),
        repo,
      );

      const first = await ingest.execute(IsoDate.of('2026-10-20'));
      const second = await ingest.execute(IsoDate.of('2026-10-20'));

      expect(first).toMatchObject({ saved: 9, missing: [], warnings: [] });
      expect(second).toMatchObject({ saved: 0, alreadyComplete: true });
      expect(await repo.getRate('EUR', 'UAH', IsoDate.of('2026-10-20'))).toMatchObject({
        rate: '50.5972222222',
        source: 'nbp',
      });
      expect(await repo.getRate('EUR', 'PLN', IsoDate.of('2026-10-20'))).toMatchObject({
        rate: '4.3768',
        source: 'ecb',
      });
    });

    it('stores nothing for a weekend date', async () => {
      const ingest = new IngestDailyFxRatesUseCase(
        new EcbFxRateProvider(fixtureFetch(ECB_XML), clock),
        new NbpFxRateProvider(fixtureFetch(NBP_XML), clock),
        repo,
      );

      const result = await ingest.execute(IsoDate.of('2026-10-18'));

      expect(result).toMatchObject({ saved: 0, missing: ['PLN', 'USD', 'GBP', 'UAH'] });
    });
  });

  describe('GET /fx-rates', () => {
    it('is 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/fx-rates' });

      expect(res.statusCode).toBe(401);
    });

    it('returns string rates for the requested base, carried forward over the weekend', async () => {
      await repo.saveBatch([
        rate('PLN', '4.3768', '2026-10-16'),
        rate('USD', '1.1215', '2026-10-16'),
        rate('UAH', '50.5972222222', '2026-10-16', 'nbp'),
      ]);
      const token = await accessToken();

      const res = await app.inject({
        method: 'GET',
        url: '/fx-rates?date=2026-10-18&base=PLN',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        date: '2026-10-18',
        baseCurrency: 'PLN',
        rates: { EUR: '0.2284774264', USD: '0.2562374337', UAH: '11.5603231178' },
      });
    });

    it('defaults the base to EUR', async () => {
      await repo.saveBatch([rate('PLN', '4.3768', '2026-10-20')]);
      const token = await accessToken();

      const res = await app.inject({
        method: 'GET',
        url: '/fx-rates?date=2026-10-20',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.json()).toEqual({
        date: '2026-10-20',
        baseCurrency: 'EUR',
        rates: { PLN: '4.3768' },
      });
    });

    it('is 404 when no rate is stored within 7 days', async () => {
      const token = await accessToken();

      const res = await app.inject({
        method: 'GET',
        url: '/fx-rates?date=2026-10-20&base=PLN',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it.each([
      ['date=20-10-2026'],
      ['date=2026-13-40'],
      ['base=XYZ'],
      ['base=pln'],
      ['date=2026-10-20&extra=1'],
    ])('is 400 for %s', async (query) => {
      const token = await accessToken();

      const res = await app.inject({
        method: 'GET',
        url: `/fx-rates?${query}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
