import { lensGeometry } from '@power-budget/shared-app';
import { SETTLE_MS, coreMetrics, flickerOpacity, travelOpacity } from '../lightMotion.js';

describe('light motion', () => {
  it.each([0, 0.05, 0.404, 0.5, 1])('keeps coreMetrics equal to lensGeometry for f = %s', (f) => {
    const geometry = lensGeometry(f);
    const metrics = coreMetrics(f);

    expect(Math.round(metrics.radius * 200)).toBe(Number.parseInt(geometry.size, 10));
    expect(metrics.opacity.toFixed(2)).toBe(geometry.opacity);
  });

  it('clamps the fraction', () => {
    expect(coreMetrics(-1)).toEqual({ radius: 0, opacity: 0 });
    expect(coreMetrics(7)).toEqual(coreMetrics(1));
  });

  it('settles over the 420 ms sheet token', () => {
    expect(SETTLE_MS).toBe(420);
  });

  it('fades a travelling spark in and out and flickers to .84', () => {
    expect(travelOpacity(0)).toBe(0);
    expect(travelOpacity(0.5)).toBe(1);
    expect(travelOpacity(1)).toBe(0);
    expect(flickerOpacity(0)).toBe(1);
    expect(flickerOpacity(1)).toBeCloseTo(0.84);
  });
});
