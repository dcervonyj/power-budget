import { describe, expect, it } from 'vitest';
import type { GlassColors, GlassMotion } from '../src/glass/tokens.js';
import { glassDarkTheme, glassLightTheme } from '../src/glass/tokens.js';

const specColorKeys: readonly (keyof GlassColors)[] = [
  'name',
  'base',
  'fg',
  'dim',
  'faint',
  'g0',
  'g1',
  'g2',
  'edge',
  'hl',
  'sep',
  'shadow',
  'shadowF',
  'track',
  'fill',
  'fill2',
  'far',
  'farEdge',
  'accent',
  'accentInk',
  'accentTint',
  'accentEdge',
  'light',
  'lightH',
  'lightSolid',
  'lightEdge',
  'lightGlow',
  'meniscus',
  'spent',
  'glint',
  'glintRing',
  'lens',
  'lensRim',
  'spec',
  'sheen',
  'ok',
  'okTint',
  'over',
  'overTint',
  'overHatch',
  'b1',
  'b2',
  'b3',
  'glow',
  'beam',
  'scrim',
  'clear',
  'clearRim',
  'tint',
  'tintRim',
  'specular',
  'irid',
  'sweep',
  'tube',
  'tubeRim',
  'beamH',
  'beamV',
  'bloom',
  'bloomFar',
  'core',
  'caustic',
  'spark',
  'pace',
];

const specLiterals = {
  light: `light|#EEF1F4|#0E1726|#3E4A60|#46526A|rgba(255,255,255,0.74)|rgba(255,255,255,0.60)|rgba(255,255,255,0.50)|rgba(255,255,255,0.80)|rgba(255,255,255,0.95)|rgba(14,23,38,0.08)|0 1px 2px rgba(28,44,72,0.05),0 24px 48px -24px rgba(28,44,72,0.30)|0 1px 2px rgba(28,44,72,0.06),0 30px 60px -26px rgba(28,44,72,0.40)|rgba(14,23,38,0.08)|rgba(14,23,38,0.045)|rgba(14,23,38,0.08)|rgba(255,255,255,0.28)|rgba(255,255,255,0.65)|#7A4800|#1A1206|rgba(242,177,62,0.16)|rgba(122,72,0,0.28)|linear-gradient(180deg,#FFEDB8 0%,#F7C860 45%,#EDA531 100%)|linear-gradient(180deg,#FFEDB8,#F5BE4E)|#F2B13E|rgba(122,72,0,0.25)|0 0 22px rgba(255,206,120,0.45)|rgba(255,255,255,0.90)|linear-gradient(180deg,#E3E9F0,#C6D0DC)|#FFFFFF|0 0 0 1.5px #0E1726,0 0 14px 3px rgba(255,255,255,0.9)|radial-gradient(circle at 34% 26%,rgba(255,255,255,0.98),rgba(255,255,255,0.62) 46%,rgba(226,234,243,0.62) 100%)|inset 0 0 0 1px rgba(255,255,255,0.95),inset 0 -22px 44px rgba(90,110,140,0.16),inset 0 12px 26px rgba(255,255,255,0.85),0 34px 64px -30px rgba(28,44,72,0.5)|#FFFFFF|rgba(255,255,255,0.75)|#1D6A45|rgba(29,106,69,0.10)|#A3261C|rgba(163,38,28,0.10)|repeating-linear-gradient(135deg,rgba(163,38,28,0.32) 0 3px,rgba(163,38,28,0) 3px 7px)|rgba(255,222,160,0.80)|rgba(170,205,240,0.65)|rgba(228,216,198,0.65)|rgba(255,206,120,0.38)|rgba(255,255,255,0.55)|rgba(14,23,38,0.28)|rgba(255,255,255,0.16)|inset 0 0 0 1px rgba(255,255,255,0.85),inset 0 0 0 3px rgba(255,255,255,0.22),inset 2px 3px 0 -1px #FFFFFF,inset -2px -3px 6px -2px rgba(90,110,140,0.22),0 18px 36px -24px rgba(28,44,72,0.28)|rgba(226,236,248,0.62)|inset 0 0 0 1px rgba(255,255,255,0.85),inset 0 1px 0 #FFFFFF,0 1px 2px rgba(28,44,72,0.05),0 24px 48px -24px rgba(28,44,72,0.30)|radial-gradient(120% 70% at 18% 0%,rgba(255,255,255,0.85),rgba(255,255,255,0) 60%)|linear-gradient(115deg,rgba(255,255,255,0.95),rgba(150,190,255,0.55) 20%,rgba(255,160,210,0.45) 38%,rgba(255,255,255,0.35) 52%,rgba(140,235,200,0.50) 70%,rgba(255,220,150,0.55) 86%,rgba(255,255,255,0.95))|rgba(255,255,255,0.70)|rgba(255,255,255,0.45)|inset 0 0 0 1px rgba(14,23,38,0.14),inset 0 1px 0 #FFFFFF,inset 0 -2px 4px rgba(90,110,140,0.18)|linear-gradient(180deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.85) 50%,rgba(255,255,255,0) 92%),linear-gradient(90deg,rgba(240,160,40,0.30),rgba(245,178,64,0.80) 55%,rgba(255,206,120,0.95) 90%,rgba(255,206,120,0))|linear-gradient(90deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.85) 50%,rgba(255,255,255,0) 92%),linear-gradient(0deg,rgba(240,160,40,0.30),rgba(245,178,64,0.80) 55%,rgba(255,206,120,0.95) 90%,rgba(255,206,120,0))|0 0 8px 1px rgba(255,186,80,0.55),0 0 24px 6px rgba(255,200,110,0.35)|rgba(255,196,100,0.42)|radial-gradient(closest-side,rgba(255,250,232,1) 0%,rgba(255,196,90,0.95) 24%,rgba(240,160,40,0.60) 52%,rgba(240,160,40,0.20) 76%,rgba(240,160,40,0) 100%)|rgba(200,128,20,0.50)|radial-gradient(circle,#FFFFFF 0 28%,rgba(255,214,140,0.85) 44%,rgba(255,214,140,0) 70%)|#0E1726`,
  dark: `dark|#05070D|#F4F6FA|#C9CFDB|#AEB6C6|rgba(46,48,56,0.60)|rgba(41,43,50,0.54)|rgba(36,38,45,0.50)|rgba(255,255,255,0.09)|rgba(255,255,255,0.16)|rgba(255,255,255,0.08)|0 12px 32px rgba(0,0,0,0.36)|0 20px 44px rgba(0,0,0,0.50)|rgba(255,255,255,0.08)|rgba(255,255,255,0.06)|rgba(255,255,255,0.11)|rgba(255,255,255,0.025)|rgba(255,255,255,0.06)|#F5C46A|#1A1206|rgba(245,196,106,0.12)|rgba(245,196,106,0.34)|linear-gradient(180deg,#FFE3A3 0%,#F5C062 45%,#E39A2E 100%)|linear-gradient(180deg,#FFE3A3,#EFAE45)|#F2B44E|rgba(255,214,140,0.55)|0 0 28px rgba(245,180,80,0.35)|rgba(255,248,225,0.85)|linear-gradient(180deg,#3A3E48,#2A2D35)|#F4F6FA|0 0 0 1.5px #05070D,0 0 12px 2px rgba(244,246,250,0.45)|radial-gradient(circle at 34% 26%,rgba(255,255,255,0.16),rgba(255,255,255,0.05) 46%,rgba(255,255,255,0.03) 100%)|inset 0 0 0 1px rgba(255,255,255,0.14),inset 0 -22px 44px rgba(0,0,0,0.35),inset 0 12px 26px rgba(255,255,255,0.06),0 30px 60px -28px rgba(0,0,0,0.7)|rgba(255,255,255,0.55)|rgba(255,255,255,0.08)|#8FE3BB|rgba(143,227,187,0.12)|#FFAFA6|rgba(255,175,166,0.12)|repeating-linear-gradient(135deg,rgba(255,175,166,0.50) 0 3px,rgba(255,175,166,0) 3px 7px)|rgba(70,86,180,0.30)|rgba(32,128,140,0.22)|rgba(116,70,140,0.16)|rgba(232,160,64,0.20)|rgba(255,255,255,0.03)|rgba(0,0,0,0.45)|rgba(255,255,255,0.025)|inset 0 0 0 1px rgba(255,255,255,0.20),inset 0 0 0 3px rgba(255,255,255,0.035),inset 2px 3px 0 -1px rgba(255,255,255,0.38),inset -2px -3px 6px -2px rgba(0,0,0,0.55),0 18px 36px -22px rgba(0,0,0,0.6)|rgba(28,38,60,0.56)|inset 0 0 0 1px rgba(160,190,255,0.14),inset 0 1px 0 rgba(255,255,255,0.18),0 12px 32px rgba(0,0,0,0.36)|radial-gradient(120% 70% at 18% 0%,rgba(255,255,255,0.10),rgba(255,255,255,0) 60%)|linear-gradient(115deg,rgba(255,255,255,0.30),rgba(150,190,255,0.24) 20%,rgba(255,160,210,0.18) 38%,rgba(255,255,255,0.05) 52%,rgba(140,235,200,0.18) 70%,rgba(255,214,140,0.22) 86%,rgba(255,255,255,0.30))|rgba(255,255,255,0.07)|rgba(255,255,255,0.04)|inset 0 0 0 1px rgba(255,255,255,0.16),inset 0 1px 0 rgba(255,255,255,0.28),inset 0 -2px 4px rgba(0,0,0,0.35)|linear-gradient(180deg,rgba(255,255,255,0) 10%,rgba(255,250,235,0.90) 50%,rgba(255,255,255,0) 90%),linear-gradient(90deg,rgba(232,150,50,0.22),rgba(245,180,80,0.70) 55%,rgba(255,226,170,0.95) 90%,rgba(255,226,170,0))|linear-gradient(90deg,rgba(255,255,255,0) 10%,rgba(255,250,235,0.90) 50%,rgba(255,255,255,0) 90%),linear-gradient(0deg,rgba(232,150,50,0.22),rgba(245,180,80,0.70) 55%,rgba(255,226,170,0.95) 90%,rgba(255,226,170,0))|0 0 10px 1px rgba(255,200,110,0.55),0 0 28px 6px rgba(240,170,70,0.28)|rgba(240,170,70,0.26)|radial-gradient(closest-side,rgba(255,246,220,1) 0%,rgba(255,210,120,0.95) 22%,rgba(242,170,62,0.55) 50%,rgba(242,170,62,0.18) 75%,rgba(242,170,62,0) 100%)|rgba(255,220,150,0.55)|radial-gradient(circle,#FFFFFF 0 28%,rgba(255,226,170,0.85) 44%,rgba(255,226,170,0) 70%)|#F4F6FA`,
};

const specMotion: GlassMotion = {
  rise: { durationMs: 620, easing: 'cubic-bezier(.2,.8,.2,1)', staggerMs: 80, fill: 'backwards' },
  fill: { durationMs: 700, easing: 'cubic-bezier(.22,.9,.3,1)', delayMs: 220 },
  count: { durationMs: 950, easing: 'ease-out-cubic' },
  press: { durationMs: 220, easing: 'ease' },
  expand: { durationMs: 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
  sheet: { durationMs: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
  sheen: { durationMs: 700, easing: 'cubic-bezier(.4,0,.2,1)', delayMs: 380 },
  meniscusShimmer: { durationMs: 6000, easing: 'ease-in-out' },
  ambientDrift: [52000, 61000, 57000],
  live: { durationMs: 2400 },
  sweep: {
    durationMs: 12000,
    passMs: 700,
    easing: 'cubic-bezier(.4,0,.2,1)',
    delayMs: 1200,
    staggerDelaysMs: [0, 4000, 8000],
  },
  film: { durationMs: 14000, easing: 'ease-in-out', direction: 'alternate' },
  flicker: { durationMs: [4200, 5000] },
  travel: { durationMs: 3400 },
  twinkle: { durationMs: [2800, 3400] },
  caustic: { durationMs: 7000, direction: 'alternate' },
  bloom: { durationMs: 4800, direction: 'alternate' },
  reveal: { durationMs: 700, easing: 'cubic-bezier(.22,.9,.3,1)' },
  glowin: { durationMs: 700, easing: 'cubic-bezier(.22,.9,.3,1)' },
  layeredPaneFloat: { durationMs: 40000, easing: 'ease-in-out' },
};

describe('D7 Glass tokens', () => {
  it('keeps all theme key sets identical', () => {
    expect(Object.keys(glassDarkTheme.color).sort()).toEqual(
      Object.keys(glassLightTheme.color).sort(),
    );
    expect(Object.keys(glassDarkTheme.motion).sort()).toEqual(
      Object.keys(glassLightTheme.motion).sort(),
    );
    expect(Object.keys(glassDarkTheme.type).sort()).toEqual(
      Object.keys(glassLightTheme.type).sort(),
    );
    expect(Object.keys(glassDarkTheme.radius).sort()).toEqual(
      Object.keys(glassLightTheme.radius).sort(),
    );
    expect(Object.keys(glassDarkTheme.space).sort()).toEqual(
      Object.keys(glassLightTheme.space).sort(),
    );
  });

  it('retains every binding spec literal for both themes', () => {
    for (const [key, expected] of specColorKeys.map((key, index) => [
      key,
      specLiterals.light.split('|')[index],
    ])) {
      expect(glassLightTheme.color[key]).toBe(expected);
    }
    for (const [key, expected] of specColorKeys.map((key, index) => [
      key,
      specLiterals.dark.split('|')[index],
    ])) {
      expect(glassDarkTheme.color[key]).toBe(expected);
    }
  });

  it('matches D7 motion timings', () => {
    expect(glassDarkTheme.motion).toEqual(specMotion);
    expect(glassLightTheme.motion).toEqual(specMotion);
  });
});
