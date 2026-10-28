import { describe, expect, it } from 'vitest';
import { toCurrency, toSource } from '../TransactionFilterBar.js';

describe('toSource', () => {
  it.each([
    ['bank_sync', 'bank_sync'],
    // The old options both meant every bank row; their bookmarks keep working.
    ['gocardless', 'bank_sync'],
    ['wise', 'bank_sync'],
    ['manual', 'manual'],
    ['enable_banking', ''],
    [null, ''],
  ])('reads %s as %j', (value, expected) => {
    expect(toSource(value)).toBe(expected);
  });
});

describe('toCurrency', () => {
  it.each([
    ['EUR', 'EUR'],
    ['eur', 'EUR'],
    ['EU', ''],
    ['XYZ', ''],
    [null, ''],
  ])('reads %s as %j', (value, expected) => {
    expect(toCurrency(value)).toBe(expected);
  });
});
