import { describe, it, expect } from 'vitest';
import { rnDarkTheme, rnLightTheme, themeToRn } from '../src/rn.js';
import { darkTheme, lightTheme } from '../src/tokens.js';

describe('RN theme output', () => {
  it('rnDarkTheme has colorSurfaceBase', () => {
    expect(rnDarkTheme.colorSurfaceBase).toBe('#07080e');
  });

  it('rnLightTheme has colorSurfaceBase', () => {
    expect(rnLightTheme.colorSurfaceBase).toBe('#edf1f7');
  });

  it('rnDarkTheme and rnLightTheme have the same keys', () => {
    const darkKeys = Object.keys(rnDarkTheme).sort();
    const lightKeys = Object.keys(rnLightTheme).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('themeToRn produces consistent output with direct exports', () => {
    expect(themeToRn(darkTheme)).toEqual(rnDarkTheme);
    expect(themeToRn(lightTheme)).toEqual(rnLightTheme);
  });

  it('rnDarkTheme matches snapshot', () => {
    expect(rnDarkTheme).toMatchSnapshot();
  });

  it('rnLightTheme matches snapshot', () => {
    expect(rnLightTheme).toMatchSnapshot();
  });
});
