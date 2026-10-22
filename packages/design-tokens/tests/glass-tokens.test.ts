import { describe, expect, it } from 'vitest';
import { glassDarkTheme, glassLightTheme } from '../src/glass/tokens.js';

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

  it('retains binding spec literals', () => {
    const literals = [
      [glassLightTheme.color.base, '#EEF1F4'],
      [glassLightTheme.color.fg, '#0E1726'],
      [glassLightTheme.color.accent, '#7A4800'],
      [glassLightTheme.color.clear, 'rgba(255,255,255,0.16)'],
      [
        glassLightTheme.color.beamH,
        'linear-gradient(180deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.85) 50%,rgba(255,255,255,0) 92%),linear-gradient(90deg,rgba(240,160,40,0.30),rgba(245,178,64,0.80) 55%,rgba(255,206,120,0.95) 90%,rgba(255,206,120,0))',
      ],
      [glassDarkTheme.color.base, '#05070D'],
      [glassDarkTheme.color.fg, '#F4F6FA'],
      [glassDarkTheme.color.accent, '#F5C46A'],
      [glassDarkTheme.color.clear, 'rgba(255,255,255,0.025)'],
      [
        glassDarkTheme.color.beamH,
        'linear-gradient(180deg,rgba(255,255,255,0) 10%,rgba(255,250,235,0.90) 50%,rgba(255,255,255,0) 90%),linear-gradient(90deg,rgba(232,150,50,0.22),rgba(245,180,80,0.70) 55%,rgba(255,226,170,0.95) 90%,rgba(255,226,170,0))',
      ],
    ];

    for (const [actual, expected] of literals) {
      expect(actual).toBe(expected);
    }
  });

  it('matches D7 motion timings', () => {
    expect(glassDarkTheme.motion.rise.durationMs).toBe(620);
    expect(glassDarkTheme.motion.fill.durationMs).toBe(700);
    expect(glassDarkTheme.motion.reveal.durationMs).toBe(700);
    expect(glassDarkTheme.motion.press.durationMs).toBe(220);
    expect(glassDarkTheme.motion.expand.durationMs).toBe(320);
    expect(glassDarkTheme.motion.sheet.durationMs).toBe(420);
    expect(glassDarkTheme.motion.film.durationMs).toBe(14000);
    expect(glassDarkTheme.motion.sweep.durationMs).toBe(12000);
    expect(glassDarkTheme.motion.flicker.durationMs).toEqual([4200, 5000]);
  });
});
