import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyParts, type SupportedLocale } from '../src/logic/format.js';

const NBSP = ' ';
const MINUS = '−';

type Currency = 'PLN' | 'EUR' | 'USD';

const SYMBOL: Record<Currency, string> = { PLN: 'zł', EUR: '€', USD: '$' };

interface Amount {
  readonly label: string;
  readonly amountMinor: bigint;
  /** Absolute value in en grouping, e.g. "1,234.56"; split into integer and fraction. */
  readonly integer: string;
  readonly fraction: string;
}

const AMOUNTS: readonly Amount[] = [
  { label: 'positive', amountMinor: 123456n, integer: '1234', fraction: '56' },
  { label: 'below one thousand', amountMinor: 9950n, integer: '99', fraction: '50' },
  { label: 'zero', amountMinor: 0n, integer: '0', fraction: '00' },
  { label: 'below one unit', amountMinor: 5n, integer: '0', fraction: '05' },
  { label: 'large', amountMinor: 123456789012n, integer: '1234567890', fraction: '12' },
  {
    label: 'above 2^53 minor units',
    amountMinor: 123456789012345678n,
    integer: '1234567890123456',
    fraction: '78',
  },
];

const LOCALES: readonly SupportedLocale[] = ['en', 'pl', 'uk', 'ru'];
const CURRENCIES: readonly Currency[] = ['PLN', 'EUR', 'USD'];

/** The DSN layout per locale, written out independently of the implementation. */
function golden(
  currency: Currency,
  locale: SupportedLocale,
  negative: boolean,
  amount: Amount,
): string {
  const sign = negative ? MINUS : '';
  const symbol = SYMBOL[currency];
  if (locale === 'en') {
    const space = currency === 'PLN' ? NBSP : '';

    return `${sign}${symbol}${space}${group(amount.integer, ',')}.${amount.fraction}`;
  }

  return `${sign}${group(amount.integer, NBSP)},${amount.fraction}${NBSP}${symbol}`;
}

function group(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

describe('formatMoney golden values (DSN: narrow symbol, U+2212, locale grouping)', () => {
  for (const currency of CURRENCIES) {
    for (const locale of LOCALES) {
      for (const amount of AMOUNTS) {
        it(`${currency} ${locale} ${amount.label}`, () => {
          expect(formatMoney({ amountMinor: amount.amountMinor, currency }, locale)).toBe(
            golden(currency, locale, false, amount),
          );
        });

        if (amount.amountMinor !== 0n) {
          it(`${currency} ${locale} negative ${amount.label}`, () => {
            expect(formatMoney({ amountMinor: -amount.amountMinor, currency }, locale)).toBe(
              golden(currency, locale, true, amount),
            );
          });
        }
      }
    }
  }

  it('spells a few values out in full', () => {
    expect(formatMoney({ amountMinor: 123456n, currency: 'PLN' }, 'pl')).toBe(
      `1${NBSP}234,56${NBSP}zł`,
    );
    expect(formatMoney({ amountMinor: -1099n, currency: 'EUR' }, 'en')).toBe('−€10.99');
    expect(formatMoney({ amountMinor: 123456n, currency: 'USD' }, 'en')).toBe('$1,234.56');
    expect(formatMoney({ amountMinor: -123456n, currency: 'USD' }, 'ru')).toBe(
      `−1${NBSP}234,56${NBSP}$`,
    );
  });

  it('never prints zero with a minus sign', () => {
    expect(formatMoney({ amountMinor: 0n, currency: 'EUR' }, 'en')).toBe('€0.00');
  });

  it('uses the currency minor-unit digits', () => {
    expect(formatMoney({ amountMinor: 1234n, currency: 'JPY' }, 'en')).toBe('¥1,234');
  });
});

describe('formatMoneyParts', () => {
  it('splits sign, symbol, grouped integer and fraction', () => {
    const parts = formatMoneyParts({ amountMinor: -123456n, currency: 'PLN' }, 'pl');

    expect(parts).toEqual([
      { type: 'minusSign', value: MINUS },
      { type: 'integer', value: '1' },
      { type: 'group', value: NBSP },
      { type: 'integer', value: '234' },
      { type: 'decimal', value: ',' },
      { type: 'fraction', value: '56' },
      { type: 'literal', value: NBSP },
      { type: 'currency', value: 'zł' },
    ]);
  });

  it('puts the symbol first in English', () => {
    const parts = formatMoneyParts({ amountMinor: 1099n, currency: 'EUR' }, 'en');

    expect(parts).toEqual([
      { type: 'currency', value: '€' },
      { type: 'integer', value: '10' },
      { type: 'decimal', value: '.' },
      { type: 'fraction', value: '99' },
    ]);
  });

  it('groups four-digit amounts even where Intl does not (Polish)', () => {
    const parts = formatMoneyParts({ amountMinor: 123456n, currency: 'EUR' }, 'pl');

    expect(parts.filter((part) => part.type === 'group')).toEqual([{ type: 'group', value: NBSP }]);
  });
});
