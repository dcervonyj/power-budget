import { describe, expect, it } from 'vitest';
import { glassDarkTheme, glassLightTheme } from '@power-budget/design-tokens/glass';
import {
  parseCubicBezier,
  parseLinearGradient,
  parseRadialGradient,
  splitBoxShadow,
  transparentOf,
} from '../cssParse.js';

describe('parseLinearGradient', () => {
  it('reads the angle and positioned stops of the iridescent rim token', () => {
    const gradient = parseLinearGradient(glassLightTheme.color.irid);

    expect(gradient.angleDeg).toBe(115);
    expect(gradient.stops).toHaveLength(7);
    expect(gradient.stops[0]).toEqual({ color: 'rgba(255,255,255,0.95)', offset: 0 });
    expect(gradient.stops[1]).toEqual({ color: 'rgba(150,190,255,0.55)', offset: 0.2 });
    expect(gradient.stops[6]).toEqual({ color: 'rgba(255,255,255,0.95)', offset: 1 });
  });

  it('defaults to 180deg and spreads unpositioned stops', () => {
    expect(parseLinearGradient('linear-gradient(#000,#111,#222)')).toEqual({
      angleDeg: 180,
      stops: [
        { color: '#000', offset: 0 },
        { color: '#111', offset: 0.5 },
        { color: '#222', offset: 1 },
      ],
    });
  });

  it('rejects other values', () => {
    expect(() => parseLinearGradient('red')).toThrow('Not a linear-gradient');
  });
});

describe('parseRadialGradient', () => {
  it('reads the specular ellipse', () => {
    expect(parseRadialGradient(glassDarkTheme.color.specular)).toEqual({
      rx: 1.2,
      ry: 0.7,
      cx: 0.18,
      cy: 0,
      stops: [
        { color: 'rgba(255,255,255,0.10)', offset: 0 },
        { color: 'rgba(255,255,255,0)', offset: 0.6 },
      ],
    });
  });
});

describe('parseCubicBezier', () => {
  it('reads the rise easing token', () => {
    expect(parseCubicBezier(glassDarkTheme.motion.rise.easing)).toEqual([0.2, 0.8, 0.2, 1]);
  });

  it('rejects keywords', () => {
    expect(() => parseCubicBezier('ease')).toThrow('Not a cubic-bezier');
  });
});

describe('splitBoxShadow', () => {
  it('separates the inset rim from the outer drop shadow of the clear material', () => {
    const { inset, outer } = splitBoxShadow(glassLightTheme.color.clearRim);

    expect(outer).toBe('0 18px 36px -24px rgba(28,44,72,0.28)');
    expect(inset.split(', ')).toHaveLength(4);
    expect(inset.startsWith('inset 0 0 0 1px rgba(255,255,255,0.85)')).toBe(true);
  });
});

describe('transparentOf', () => {
  it('keeps the colour and drops the alpha', () => {
    expect(transparentOf('rgba(70,86,180,0.30)')).toBe('rgba(70,86,180,0)');
    expect(transparentOf('#fff')).toBe('rgba(0,0,0,0)');
  });
});
