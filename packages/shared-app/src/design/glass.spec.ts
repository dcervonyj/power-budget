import { describe, expect, it } from 'vitest';
import {
  formatMoneyParts,
  lensGeometry,
  lightFraction,
  paceMark,
  rodBeam,
  stagger,
  statusKind,
} from './glass.js';
import type { DesignLocale } from './glass.js';

describe('glass maths', () => {
  it('maps the dashboard fraction to the R2.4 lens recipe', () => {
    const fraction = lightFraction(
      { amountMinor: 4770n, currency: 'PLN' },
      { amountMinor: 11800n, currency: 'PLN' },
    );

    expect(fraction).toBeCloseTo(0.404, 3);
    expect(lensGeometry(fraction)).toEqual({
      size: '62%',
      opacity: '0.77',
      bloomOpacity: '0.70',
      hasCore: true,
    });
    expect(rodBeam(fraction)).toEqual({ width: '40.4%', hasSpark: true });
    expect(paceMark(0.71)).toBe('29%');
  });

  it('clamps fractions and hides empty or over-budget light', () => {
    expect(
      lightFraction({ amountMinor: -1n, currency: 'PLN' }, { amountMinor: 1n, currency: 'PLN' }),
    ).toBe(0);
    expect(
      lightFraction({ amountMinor: 2n, currency: 'PLN' }, { amountMinor: 1n, currency: 'PLN' }),
    ).toBe(1);
    expect(() =>
      lightFraction({ amountMinor: 1n, currency: 'EUR' }, { amountMinor: 1n, currency: 'PLN' }),
    ).toThrow('different currencies');
    expect(lensGeometry(0).hasCore).toBe(false);
    expect(rodBeam(-1)).toEqual({ width: '0.0%', hasSpark: false });
    expect(lensGeometry(Number.NaN).hasCore).toBe(false);
    expect(rodBeam(Number.NaN)).toEqual({ width: '0.0%', hasSpark: false });
  });

  it('creates independent row timing and state tags', () => {
    expect(stagger(3)).toEqual({ delay: '240ms', flickerDelay: '1110ms', sparkDelay: '1110ms' });
    expect(statusKind('ok', false)).toBe('ok');
    expect(statusKind('over', false)).toBe('over');
    expect(statusKind('over', true)).toBe('neutral');
  });
});

describe('formatMoneyParts', () => {
  const plGrouping = ' ';
  const plOnlyFormatter = booleanOnlyPolishFormatter('pl', 'PLN', 2);
  const plMoneyCases: ReadonlyArray<{
    readonly locale: DesignLocale;
    readonly fourDigits: string;
    readonly sevenDigits: string;
    readonly belowThousand: string;
  }> = [
    {
      locale: 'en',
      fourDigits: 'zł 1,234.56',
      sevenDigits: 'zł 1,234,567.00',
      belowThousand: 'zł 123.45',
    },
    {
      locale: 'pl',
      fourDigits: '1 234,56 zł',
      sevenDigits: '1 234 567,00 zł',
      belowThousand: '123,45 zł',
    },
    {
      locale: 'uk',
      fourDigits: '1 234,56 zł',
      sevenDigits: '1 234 567,00 zł',
      belowThousand: '123,45 zł',
    },
    {
      locale: 'ru',
      fourDigits: '1 234,56 zł',
      sevenDigits: '1 234 567,00 zł',
      belowThousand: '123,45 zł',
    },
  ];
  const eurCases: ReadonlyArray<{
    readonly locale: DesignLocale;
    readonly expected: string;
    readonly expectedNegative: string;
  }> = [
    { locale: 'en', expected: '€1,234.56', expectedNegative: '−€10.99' },
    { locale: 'pl', expected: '1 234,56 €', expectedNegative: '−10,99 €' },
    { locale: 'uk', expected: '1 234,56 €', expectedNegative: '−10,99 €' },
    { locale: 'ru', expected: '1 234,56 €', expectedNegative: '−10,99 €' },
  ];

  it.each(plMoneyCases)(
    'formats four-digit, seven-digit, and below-thousand PLN amounts in $locale',
    ({ locale, fourDigits, sevenDigits, belowThousand }) => {
      expect(
        formatMoneyParts({ amountMinor: 123456n, currency: 'PLN' }, locale).map(partValue).join(''),
      ).toBe(fourDigits);
      expect(
        formatMoneyParts({ amountMinor: 123456700n, currency: 'PLN' }, locale)
          .map(partValue)
          .join(''),
      ).toBe(sevenDigits);
      expect(
        formatMoneyParts({ amountMinor: 12345n, currency: 'PLN' }, locale).map(partValue).join(''),
      ).toBe(belowThousand);
    },
  );

  it('groups Polish four-digit amounts when the formatter supports boolean grouping only', () => {
    expect(plOnlyFormatter.formatToParts(1234.56).some(hasGroupPart)).toBe(false);

    const formatted = formatMoneyParts(
      { amountMinor: 123456n, currency: 'PLN' },
      'pl',
      booleanOnlyPolishFormatter,
    );

    expect(formatted.map(partValue).join('')).toBe(`1${plGrouping}234,56${plGrouping}zł`);
  });

  it.each(eurCases)(
    'formats EUR negatives with U+2212 in $locale',
    ({ locale, expected, expectedNegative }) => {
      const eurParts = formatMoneyParts({ amountMinor: 123456n, currency: 'EUR' }, locale);
      const negativeParts = formatMoneyParts({ amountMinor: -1099n, currency: 'EUR' }, locale);

      expect(eurParts.map((part) => part.value).join('')).toBe(expected);
      expect(negativeParts.map((part) => part.value).join('')).toBe(expectedNegative);
    },
  );

  it('uses the currency minor-unit digits', () => {
    const parts = formatMoneyParts({ amountMinor: 1234n, currency: 'JPY' }, 'en');

    expect(parts.map((part) => part.value).join('')).toBe('¥1,234');
  });
});

function booleanOnlyPolishFormatter(
  _locale: DesignLocale,
  currency: string,
  digits: number,
): Intl.NumberFormat {
  const formatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  });
  const formatToParts = formatter.formatToParts.bind(formatter);

  Object.defineProperty(formatter, 'formatToParts', {
    value(value: number | bigint): Intl.NumberFormatPart[] {
      const parts = formatToParts(value);
      if (Number(value) < 1000000) {
        return parts.filter(notGroupPart);
      }

      return parts;
    },
  });

  return formatter;
}

function hasGroupPart(part: Intl.NumberFormatPart): boolean {
  return part.type === 'group';
}

function notGroupPart(part: Intl.NumberFormatPart): boolean {
  return part.type !== 'group';
}

function partValue(part: { readonly value: string }): string {
  return part.value;
}
