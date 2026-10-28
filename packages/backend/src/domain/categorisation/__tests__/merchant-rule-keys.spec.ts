import { describe, expect, it } from 'vitest';
import { merchantRuleConfidence, merchantRuleKeysOf } from '../merchant-rule-keys.js';

describe('merchantRuleKeysOf', () => {
  it('puts the counterparty IBAN hash before the merchant key', () => {
    expect(
      merchantRuleKeysOf({
        counterpartyIbanHash: 'hash-1',
        counterpartyName: 'Biedronka',
        merchant: null,
        description: '',
      }),
    ).toEqual([
      { matchKind: 'counterparty_iban_hash', pattern: 'hash-1' },
      { matchKind: 'merchant', pattern: 'biedronka' },
    ]);
  });

  it('gives the same key for a name and a noisy descriptor of the same merchant', () => {
    const fromName = merchantRuleKeysOf({
      counterpartyIbanHash: null,
      counterpartyName: 'Biedronka',
      merchant: null,
      description: '',
    });
    const fromDescriptor = merchantRuleKeysOf({
      counterpartyIbanHash: null,
      counterpartyName: null,
      merchant: null,
      description: 'Card payment to Biedronka ****1234 14:32',
    });

    expect(fromDescriptor).toEqual(fromName);
  });

  const noCounterparty = { counterpartyIbanHash: null, counterpartyName: null, merchant: null };

  it('learns no key from a noise-only counterparty name', () => {
    expect(
      merchantRuleKeysOf({
        ...noCounterparty,
        counterpartyName: '123456789',
        description: '',
      }),
    ).toEqual([]);
  });

  it('learns no key from a generic transfer title', () => {
    expect(merchantRuleKeysOf({ ...noCounterparty, description: 'Faktura 123/2026' })).toEqual([]);
    expect(merchantRuleKeysOf({ ...noCounterparty, description: 'Zwrot' })).toEqual([]);
  });

  it.each([
    ['Biedronka', 'biedronka'],
    ['BIEDRONKA 1234 WARSZAWA', 'biedronka'],
  ])('learns a key from the description alone: %s', (description, pattern) => {
    expect(merchantRuleKeysOf({ ...noCounterparty, description })).toEqual([
      { matchKind: 'merchant', pattern },
    ]);
  });

  it('still learns a key from a Wise card title', () => {
    const keys = merchantRuleKeysOf({
      ...noCounterparty,
      description: 'Card transaction of 12.34 PLN issued by Biedronka',
    });

    expect(keys).toHaveLength(1);
    expect(keys[0]?.pattern).toContain('biedronka');
  });

  it('keeps the counterparty of a transfer description', () => {
    expect(
      merchantRuleKeysOf({ ...noCounterparty, description: 'Przelew do Jan Kowalski, czynsz' }),
    ).toEqual([{ matchKind: 'merchant', pattern: 'jan kowalski' }]);
  });

  it('lists a merchant key once', () => {
    const keys = merchantRuleKeysOf({
      counterpartyIbanHash: null,
      counterpartyName: 'Biedronka',
      merchant: 'Biedronka',
      description: 'Biedronka',
    });

    expect(keys).toEqual([{ matchKind: 'merchant', pattern: 'biedronka' }]);
  });
});

describe('merchantRuleConfidence', () => {
  it('rises with confirmations and stops at 0.95', () => {
    expect([1, 2, 3, 4, 10].map(merchantRuleConfidence)).toEqual([0.8, 0.85, 0.9, 0.95, 0.95]);
  });
});
