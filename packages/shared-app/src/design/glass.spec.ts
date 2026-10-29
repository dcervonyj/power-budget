import { describe, expect, it } from 'vitest';
import { lensGeometry, lightFraction, paceMark, rodBeam, stagger, statusKind } from './glass.js';

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
