import { describe, it, expect } from 'vitest';
import { formatMoney, formatDate, formatNumber } from '../src/logic/format.js';

describe('formatMoney', () => {
  const pln1000 = { amountMinor: 100000n, currency: 'PLN' as const }; // 1000.00 PLN

  it('en snapshot', () => {
    expect(formatMoney(pln1000, 'en')).toMatchSnapshot();
  });

  it('pl snapshot', () => {
    expect(formatMoney(pln1000, 'pl')).toMatchSnapshot();
  });

  it('uk snapshot', () => {
    expect(formatMoney(pln1000, 'uk')).toMatchSnapshot();
  });

  it('ru snapshot', () => {
    expect(formatMoney(pln1000, 'ru')).toMatchSnapshot();
  });

  it('EUR en snapshot', () => {
    const eur = { amountMinor: 1099n, currency: 'EUR' as const }; // 10.99 EUR
    expect(formatMoney(eur, 'en')).toMatchSnapshot();
  });

  it('UAH uk snapshot', () => {
    const uah = { amountMinor: 999900n, currency: 'UAH' as const }; // 9999.00 UAH
    expect(formatMoney(uah, 'uk')).toMatchSnapshot();
  });
});

describe('formatDate', () => {
  const date = '2024-01-15' as any; // IsoDate

  it('en snapshot', () => {
    expect(formatDate(date, 'en')).toMatchSnapshot();
  });

  it('pl snapshot', () => {
    expect(formatDate(date, 'pl')).toMatchSnapshot();
  });

  it('uk snapshot', () => {
    expect(formatDate(date, 'uk')).toMatchSnapshot();
  });

  it('ru snapshot', () => {
    expect(formatDate(date, 'ru')).toMatchSnapshot();
  });

  it('also accepts Date object', () => {
    const d = new Date('2024-03-20T12:00:00Z');
    const result = formatDate(d, 'en');
    expect(result).toMatchSnapshot();
  });
});

describe('formatNumber', () => {
  it('en snapshot — integer', () => {
    expect(formatNumber(1234567, 'en')).toMatchSnapshot();
  });

  it('pl snapshot — decimal', () => {
    expect(formatNumber(1234.56, 'pl')).toMatchSnapshot();
  });

  it('uk snapshot', () => {
    expect(formatNumber(99.9, 'uk')).toMatchSnapshot();
  });

  it('ru snapshot', () => {
    expect(formatNumber(1000000, 'ru')).toMatchSnapshot();
  });
});
