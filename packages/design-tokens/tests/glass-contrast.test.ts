import { describe, expect, it } from 'vitest';
import { glassDarkTheme, glassLightTheme } from '../src/glass/tokens.js';

interface Rgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

function hex(value: string): Rgb {
  const match = /^#([0-9A-F]{6})$/i.exec(value);
  if (match === null || match[1] === undefined) {
    throw new Error(`Expected hex colour: ${value}`);
  }

  const source = match[1];
  const red = Number.parseInt(source.slice(0, 2), 16);
  const green = Number.parseInt(source.slice(2, 4), 16);
  const blue = Number.parseInt(source.slice(4, 6), 16);

  return { red, green, blue };
}

function composite(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  return {
    red: foreground.red * alpha + background.red * (1 - alpha),
    green: foreground.green * alpha + background.green * (1 - alpha),
    blue: foreground.blue * alpha + background.blue * (1 - alpha),
  };
}

function luminance(color: Rgb): number {
  const channels = [color.red, color.green, color.blue].map((value) => {
    const normalized = value / 255;

    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  const red = channels[0];
  const green = channels[1];
  const blue = channels[2];
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error('Expected RGB channels');
  }

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function ratio(first: Rgb, second: Rgb): number {
  const brighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));

  return (brighter + 0.05) / (darker + 0.05);
}

function expectContrast(pair: string, foreground: string, background: Rgb): void {
  expect(ratio(hex(foreground), background), pair).toBeGreaterThanOrEqual(4.5);
}

describe('R2.6 contrast', () => {
  it('passes worst-case and Android no-blur composites', () => {
    const darkBloom = composite(hex('#F0AA46'), 0.26, hex('#05070D'));
    const darkFrosted = composite(hex('#292B32'), 0.54, darkBloom);
    const darkNoBlur = composite(hex('#1C263C'), 0.56, darkBloom);
    const lightSun = hex('#FBE5BA');
    const lightClear = composite(hex('#FFFFFF'), 0.16, lightSun);
    const lightNoBlur = composite(hex('#E2ECF8'), 0.62, lightSun);

    const contrastCases = [
      { name: 'dark frosted', background: darkFrosted, theme: glassDarkTheme },
      { name: 'dark Android no-blur', background: darkNoBlur, theme: glassDarkTheme },
      { name: 'light clear', background: lightClear, theme: glassLightTheme },
      { name: 'light Android no-blur', background: lightNoBlur, theme: glassLightTheme },
    ];
    for (const contrastCase of contrastCases) {
      expectContrast(
        `${contrastCase.name}: fg`,
        contrastCase.theme.color.fg,
        contrastCase.background,
      );
      expectContrast(
        `${contrastCase.name}: dim`,
        contrastCase.theme.color.dim,
        contrastCase.background,
      );
      expectContrast(
        `${contrastCase.name}: faint`,
        contrastCase.theme.color.faint,
        contrastCase.background,
      );
      expectContrast(
        `${contrastCase.name}: accent`,
        contrastCase.theme.color.accent,
        contrastCase.background,
      );
    }

    expectContrast(
      'dark accentInk on lightSolid',
      glassDarkTheme.color.accentInk,
      hex(glassDarkTheme.color.lightSolid),
    );
    expectContrast(
      'light accentInk on lightSolid',
      glassLightTheme.color.accentInk,
      hex(glassLightTheme.color.lightSolid),
    );
  });
});
