import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EcbFxRateProvider } from './EcbFxRateProvider.js';

const ECB_XML = readFileSync(join(__dirname, '__fixtures__/ecb-daily.xml'), 'utf-8');

function makeFetchMock(body: string, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: () => Promise.resolve(body),
  });
}

const FETCH_DATE = new Date('2026-01-15T10:00:00.000Z');

describe('EcbFxRateProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses EUR/USD pair with correct rateMinorUnits', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);
    const eurUsd = rates.find((r) => r.base === 'EUR' && r.quote === 'USD');

    expect(eurUsd).toBeDefined();
    // 1.0842 × 1_000_000 = 1_084_200
    expect(eurUsd!.rateMinorUnits).toBe(1_084_200n);
  });

  it('parses EUR/PLN pair', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);
    const eurPln = rates.find((r) => r.base === 'EUR' && r.quote === 'PLN');

    expect(eurPln).toBeDefined();
    // 4.2734 × 1_000_000 = 4_273_400
    expect(eurPln!.rateMinorUnits).toBe(4_273_400n);
  });

  it('parses EUR/GBP pair', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);
    const eurGbp = rates.find((r) => r.base === 'EUR' && r.quote === 'GBP');

    expect(eurGbp).toBeDefined();
    expect(eurGbp!.rateMinorUnits).toBe(838_200n);
  });

  it('parses EUR/UAH pair', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);
    const eurUah = rates.find((r) => r.base === 'EUR' && r.quote === 'UAH');

    expect(eurUah).toBeDefined();
    expect(eurUah!.rateMinorUnits).toBe(44_871_200n);
  });

  it('sets source to ECB on all rates', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);

    expect(rates.every((r) => r.source === 'ECB')).toBe(true);
  });

  it('sets rateOnDate from XML time attribute', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);

    expect(rates.every((r) => r.rateOnDate === '2026-01-15')).toBe(true);
  });

  it('derives inverse pairs (USD/EUR)', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);
    const usdEur = rates.find((r) => r.base === 'USD' && r.quote === 'EUR');

    expect(usdEur).toBeDefined();
    // 1/1.0842 × 1_000_000 ≈ 922_335
    const expected = BigInt(Math.round((1 / 1.0842) * 1_000_000));
    expect(usdEur!.rateMinorUnits).toBe(expected);
  });

  it('derives cross pairs (USD/PLN)', async () => {
    vi.stubGlobal('fetch', makeFetchMock(ECB_XML));
    const provider = new EcbFxRateProvider();

    const rates = await provider.fetchForDate(FETCH_DATE);
    const usdPln = rates.find((r) => r.base === 'USD' && r.quote === 'PLN');

    expect(usdPln).toBeDefined();
    // 4.2734 / 1.0842 × 1_000_000
    const expected = BigInt(Math.round((4.2734 / 1.0842) * 1_000_000));
    expect(usdPln!.rateMinorUnits).toBe(expected);
  });

  it('throws when fetch returns non-OK status', async () => {
    vi.stubGlobal('fetch', makeFetchMock('', false));
    const provider = new EcbFxRateProvider();

    await expect(provider.fetchForDate(FETCH_DATE)).rejects.toThrow('ECB fetch failed');
  });
});
