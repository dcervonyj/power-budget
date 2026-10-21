import { describe, expect, it } from 'vitest';
import { toRateTable } from './FxRateCache.js';

describe('toRateTable', () => {
  it('turns the decimal-string rates of GET /fx-rates into a display table', () => {
    const table = toRateTable(
      { date: '2026-10-20', baseCurrency: 'PLN', rates: { EUR: '0.2284774264', XXX: 'oops' } },
      '2026-10-21T10:00:00.000Z',
    );

    expect(table).toEqual({
      baseCurrency: 'PLN',
      rates: { EUR: 0.2284774264 },
      fetchedAt: '2026-10-21T10:00:00.000Z',
    });
  });
});
