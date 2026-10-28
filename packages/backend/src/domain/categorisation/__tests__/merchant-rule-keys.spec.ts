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

  it('learns the merchant only from a Wise card title, whatever the amount or currency', () => {
    const pln = merchantRuleKeysOf({
      ...noCounterparty,
      description: 'Card transaction of 12.34 PLN issued by Biedronka',
    });
    const eur = merchantRuleKeysOf({
      ...noCounterparty,
      description: 'card transaction of 1,234.56 EUR issued by BIEDRONKA',
    });

    expect(pln).toEqual([{ matchKind: 'merchant', pattern: 'biedronka' }]);
    expect(eur).toEqual(pln);
  });

  it.each(['Warszawa', '', '****1234', '123456'])(
    'never learns an amount-dependent key from a Wise card title ending in: "%s"',
    (tail) => {
      const small = merchantRuleKeysOf({
        ...noCounterparty,
        description: `Card transaction of 12.34 PLN issued by ${tail}`.trim(),
      });
      const large = merchantRuleKeysOf({
        ...noCounterparty,
        description: `Card transaction of 1,999.00 EUR issued by ${tail}`.trim(),
      });

      expect(large).toEqual(small);
      expect(JSON.stringify(small)).not.toContain('12');
    },
  );

  it.each([
    ['ATM Shop', 'atm shop'],
    ['Transfer Market', 'transfer market'],
    ['Fee Shop', 'fee shop'],
  ])('learns the merchant %s from a Wise card title', (merchant, pattern) => {
    expect(
      merchantRuleKeysOf({
        ...noCounterparty,
        description: `Card transaction of 12.34 PLN issued by ${merchant}`,
      }),
    ).toEqual([{ matchKind: 'merchant', pattern }]);
  });

  it('still treats a plain description starting with a generic word as generic', () => {
    expect(merchantRuleKeysOf({ ...noCounterparty, description: 'Transfer Market' })).toEqual([]);
  });

  it('keeps the key of a title that is not a Wise card title', () => {
    expect(
      merchantRuleKeysOf({ ...noCounterparty, description: 'Card payment to Biedronka 12.34' }),
    ).toEqual([{ matchKind: 'merchant', pattern: 'biedronka 12 34' }]);
  });

  it('keeps the counterparty of a transfer description', () => {
    expect(
      merchantRuleKeysOf({ ...noCounterparty, description: 'Przelew do Jan Kowalski, czynsz' }),
    ).toEqual([{ matchKind: 'merchant', pattern: 'jan kowalski' }]);
  });

  it('does not learn shared bank boilerplate when the row names its counterparty', () => {
    const boilerplate = 'ZAKUP PRZY UŻYCIU KARTY';
    const biedronka = merchantRuleKeysOf({
      ...noCounterparty,
      counterpartyName: 'Biedronka',
      description: boilerplate,
    });
    const rossmann = merchantRuleKeysOf({
      ...noCounterparty,
      counterpartyName: 'Rossmann',
      description: boilerplate,
    });

    expect(biedronka).toEqual([{ matchKind: 'merchant', pattern: 'biedronka' }]);
    expect(rossmann).toEqual([{ matchKind: 'merchant', pattern: 'rossmann' }]);
  });

  it('learns no key from bare bank boilerplate without a counterparty', () => {
    expect(merchantRuleKeysOf({ ...noCounterparty, description: 'Zakup BLIK' })).toEqual([]);
    expect(merchantRuleKeysOf({ ...noCounterparty, description: 'BLIK' })).toEqual([]);
  });

  it.each(['Zakup BLIK Biedronka', 'Zakup przy użyciu karty Biedronka 1234'])(
    'strips leading boilerplate and keeps the merchant: %s',
    (description) => {
      expect(merchantRuleKeysOf({ ...noCounterparty, description })).toEqual([
        { matchKind: 'merchant', pattern: 'biedronka' },
      ]);
    },
  );

  it('drops a key longer than the 255 character pattern column', () => {
    const description = `Biedronka ${'sklep spozywczy '.repeat(20)}`;

    expect(description.length).toBeGreaterThan(300);
    expect(merchantRuleKeysOf({ ...noCounterparty, description })).toEqual([]);
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
