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

  it('learns no key from noise-only text or a generic transfer title', () => {
    const keys = merchantRuleKeysOf({
      counterpartyIbanHash: null,
      counterpartyName: '123456789',
      merchant: null,
      description: 'Faktura 123/2026',
    });

    expect(keys).toEqual([]);
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
