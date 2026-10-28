import { describe, expect, it } from 'vitest';
import { toCurrency, toSource } from '../TransactionFilterBar.js';

describe('toSource', () => {
  it.each([
    ['bank_sync', 'bank_sync'],
    // Providers (SYNC-001 `source_kind`), kept from the URL (review F2).
    ['enable_banking', 'enable_banking'],
    ['wise_webhook', 'wise_webhook'],
    ['pko_email', 'pko_email'],
    ['iko_push', 'iko_push'],
    // Old options: both always returned every bank row, and their links keep that (review F3).
    ['gocardless', 'bank_sync'],
    ['wise', 'bank_sync'],
    ['manual', 'manual'],
    ['paypal', ''],
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
