import { describe, expect, it } from 'vitest';
import { firstColor, gradientLayers, parseGradientStops, parseLayerStops } from './cssColors.js';

describe('cssColors', () => {
  it('reads the stops of a radial gradient', () => {
    const stops = parseGradientStops(
      'radial-gradient(closest-side,rgba(255,250,232,1) 0%,rgba(240,160,40,0.60) 52%,rgba(240,160,40,0) 100%)',
    );

    expect(stops.colors).toEqual([
      'rgba(255,250,232,1)',
      'rgba(240,160,40,0.60)',
      'rgba(240,160,40,0)',
    ]);
    expect(stops.positions).toEqual([0, 0.52, 1]);
  });

  it('skips the direction and spreads stops that have no position', () => {
    const stops = parseGradientStops('linear-gradient(180deg,#FFEDB8,#F7C860,#EDA531)');

    expect(stops.colors).toEqual(['#FFEDB8', '#F7C860', '#EDA531']);
    expect(stops.positions).toEqual([0, 0.5, 1]);
  });

  it('takes the last position of a two-position stop', () => {
    const stops = parseGradientStops('radial-gradient(circle,#FFFFFF 0 28%,rgba(1,2,3,0) 70%)');

    expect(stops.positions).toEqual([0.28, 0.7]);
  });

  it('splits a multi-layer background and reads each layer', () => {
    const css =
      'linear-gradient(180deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.85) 50%),linear-gradient(90deg,rgba(240,160,40,0.30),rgba(255,206,120,0))';

    expect(gradientLayers(css)).toHaveLength(2);
    expect(parseLayerStops(css, 1).colors).toEqual([
      'rgba(240,160,40,0.30)',
      'rgba(255,206,120,0)',
    ]);
    expect(parseLayerStops(css, 0).positions).toEqual([0.08, 0.5]);
  });

  it('finds the first colour of a shadow list', () => {
    expect(firstColor('inset 0 0 0 1px rgba(255,255,255,0.95),inset 0 12px 26px #fff')).toBe(
      'rgba(255,255,255,0.95)',
    );
    expect(firstColor('none')).toBe('transparent');
  });
});
