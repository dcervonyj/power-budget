import { describe, expect, it } from 'vitest';
import { normaliseText, normaliseTransaction } from './normalise-transaction.js';

const MERCHANTS: ReadonlyArray<readonly [string, string]> = [
  ['Żabka', 'zabka'],
  ['Biedronka', 'biedronka'],
  ['Lidl', 'lidl'],
  ['Carrefour', 'carrefour'],
  ['Kaufland', 'kaufland'],
  ['Rossmann', 'rossmann'],
  ['Hebe', 'hebe'],
  ['Orlen', 'orlen'],
  ['Shell', 'shell'],
  ['McDonalds', 'mcdonalds'],
  ['Starbucks', 'starbucks'],
  ['Pizza Hut', 'pizza hut'],
  ['Empik', 'empik'],
  ['Decathlon', 'decathlon'],
  ['IKEA', 'ikea'],
  ['Żołądkowa Gorzka', 'zoladkowa gorzka'],
  ['Łódzka Piekarnia', 'lodzka piekarnia'],
  ['Książnica Księgarnia', 'ksiaznica ksiegarnia'],
  ['Cukiernia Świętojańska', 'cukiernia swietojanska'],
  ['Apteka Źródło', 'apteka zrodlo'],
  ['Zażółć Gęślą', 'zazolc gesla'],
  ['Netflix', 'netflix'],
  ['Spotify', 'spotify'],
  ['Uber', 'uber'],
  ['Bolt', 'bolt'],
];

const TEMPLATES: ReadonlyArray<(m: string) => string> = [
  (m) => `Card payment to ${m}`,
  (m) => `${m.toUpperCase()} Z1234 K.1`,
  (m) => `PLATNOSC KARTA ${m} 4412 WARSZAWA ****1234 2026-10-12`,
  (m) => `${m} 5521 KRAKÓW PL 12.10.2026 14:32`,
  (m) => `Płatność kartą ${m} Z1234 K.1`,
  (m) => `Płatność BLIK ${m}`,
];

describe('normaliseText', () => {
  it('folds Polish diacritics instead of dropping them', () => {
    expect(normaliseText('Żabka ąćęłńóśźż')).toBe('zabka acelnoszz');
  });

  it('keeps Cyrillic letters', () => {
    expect(normaliseText('Сільпо  Київ')).toBe('сільпо київ');
  });
});

describe('normaliseTransaction merchant key golden set', () => {
  const cases = MERCHANTS.flatMap(([merchant, key]) =>
    TEMPLATES.map((template) => ({ input: template(merchant), key })),
  );

  it('covers at least 100 descriptors', () => {
    expect(cases.length).toBeGreaterThanOrEqual(100);
  });

  it.each(cases)('$input -> $key', ({ input, key }) => {
    expect(normaliseTransaction(input).merchantKey).toBe(key);
  });
});

describe('normaliseTransaction realistic PKO / Wise forms', () => {
  // Hand-written in the real PKO BP / Wise formats. A fixture of real anonymised
  // descriptors from SPK-001/003 is a follow-up once that data exists.
  it.each([
    ['Płatność kartą ŻABKA Z1234 K.1 WARSZAWA', 'zabka', 'card'],
    ['Płatność BLIK Żabka', 'zabka', 'blik_merchant'],
    ['Płatność kartą Notino', 'notino', 'card'],
    ['Płatność kartą The North Face', 'the north face', 'card'],
    ['Card payment to Blikle', 'blikle', 'card'],
    ['Card payment to Feelunique', 'feelunique', 'card'],
    ['Card payment to Allegro', 'allegro', 'allegro'],
    ['PAYU *Allegro order 123', 'allegro order', 'payu'],
    ['Card payment to Termos Shop', 'termos shop', 'card'],
    ['Card payment to Ideaprint', 'ideaprint', 'card'],
    ['Card payment to Straße Bistro', 'strasse bistro', 'card'],
    ['Wypłata gotówki bankomat PKO', 'pko', 'atm'],
    ['Opłata za kartę', 'za karte', 'fee'],
  ])('%s -> key %s, class %s', (input, key, descriptorClass) => {
    const result = normaliseTransaction(input);

    expect(result.merchantKey).toBe(key);
    expect(result.descriptorClass).toBe(descriptorClass);
  });

  it.each([
    ['BLIK przelew na telefon Jan Kowalski', 'blik_p2p', 'Jan Kowalski'],
    ['Przelew od: Anna Nowak', 'transfer', 'Anna Nowak'],
    ['Nadawca: Piotr Żak', 'transfer', 'Piotr Żak'],
    ['Transfer from Maria Lis', 'transfer', 'Maria Lis'],
    ['Przelew do: Jan Kowalski opłata za czynsz', 'transfer', 'Jan Kowalski opłata za czynsz'],
  ])('%s -> %s, counterparty %s', (input, descriptorClass, counterparty) => {
    const result = normaliseTransaction(input);

    expect(result.descriptorClass).toBe(descriptorClass);
    expect(result.counterparty).toBe(counterparty);
    expect(result.merchant).toBe(counterparty);
  });
});

describe('normaliseTransaction acceptance', () => {
  it('maps "Żabka" and "ZABKA Z1234 K.1" to the same merchant key', () => {
    expect(normaliseTransaction('Żabka').merchantKey).toBe(
      normaliseTransaction('ZABKA Z1234 K.1').merchantKey,
    );
  });
});

describe('normaliseTransaction descriptor classes', () => {
  it.each([
    ['PAYU *Allegro order 123', 'payu'],
    ['Przelewy24 Sklep XYZ', 'przelewy24'],
    ['Allegro.pl zakup', 'allegro'],
    ['BLIK przelew na telefon Jan Kowalski', 'blik_p2p'],
    ['Platnosc BLIK Zabka', 'blik_merchant'],
    ['Wypłata gotówki bankomat Warszawa', 'atm'],
    ['Opłata za prowadzenie rachunku', 'fee'],
    ['Przelew do: Anna Nowak', 'transfer'],
    ['Card payment to Lidl', 'card'],
    ['Wynagrodzenie', 'unclassified'],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseTransaction(input).descriptorClass).toBe(expected);
  });
});

describe('normaliseTransaction extraction', () => {
  it('extracts the counterparty of a transfer and strips date and reference', () => {
    const result = normaliseTransaction('Przelew do: Łukasz Żak ref: ABC123456 2026-10-01');

    expect(result.counterparty).toBe('Łukasz Żak');
    expect(result.merchant).toBe('Łukasz Żak');
  });

  it('extracts the recipient of a Wise transfer', () => {
    expect(normaliseTransaction('Transfer to Jan Kowalski').counterparty).toBe('Jan Kowalski');
  });

  it('has no counterparty for card payments', () => {
    expect(normaliseTransaction('Card payment to Lidl').counterparty).toBeNull();
  });

  it('strips card masks and times from the merchant', () => {
    expect(normaliseTransaction('Card payment to Lidl ****1234 14:32').merchant).toBe('Lidl');
  });
});

describe('normaliseTransaction performance', () => {
  it.each(['odbiorca', 'payu', 'ref', 'terminal', 'card payment to'])(
    'handles a long whitespace run after %s in linear time',
    (prefix) => {
      const started = performance.now();

      normaliseTransaction(`${prefix}${' '.repeat(50000)}x`);
      normaliseTransaction(`${prefix}${'\t'.repeat(50000)}x`);
      normaliseTransaction(`${prefix}${'\u00a0\n'.repeat(25000)}x`);

      expect(performance.now() - started).toBeLessThan(500);
    },
  );
});
