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
    expect(
      lightFraction({ amountMinor: 1n, currency: 'EUR' }, { amountMinor: 1n, currency: 'PLN' }),
    ).toBe(0);
    expect(lensGeometry(0).hasCore).toBe(false);
    expect(rodBeam(-1)).toEqual({ width: '0.0%', hasSpark: false });
  });

  it('creates independent row timing and state tags', () => {
    expect(stagger(3)).toEqual({ delay: '240ms', flickerDelay: '1110ms', sparkDelay: '1110ms' });
    expect(statusKind('ok', false)).toBe('ok');
    expect(statusKind('over', false)).toBe('over');
    expect(statusKind('over', true)).toBe('neutral');
  });
});

describe('formatMoneyParts', () => {
  const locales: readonly DesignLocale[] = ['en', 'pl', 'uk', 'ru'];

  it.each(locales)('formats PLN in %s with a narrow zł symbol', (locale) => {
    const parts = formatMoneyParts({ amountMinor: 123456n, currency: 'PLN' }, locale);

    expect(parts.some((part) => part.type === 'currency' && part.value === 'zł')).toBe(true);
    expect(parts.some((part) => part.type === 'fraction' && part.value === '56')).toBe(true);
  });

  it('formats EUR and replaces the locale minus with U+2212', () => {
    const parts = formatMoneyParts({ amountMinor: -1099n, currency: 'EUR' }, 'en');

    expect(parts.some((part) => part.type === 'currency' && part.value === '€')).toBe(true);
    expect(parts.some((part) => part.type === 'minusSign' && part.value === '−')).toBe(true);
  });
});
