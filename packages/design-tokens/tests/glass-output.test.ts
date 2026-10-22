import { describe, expect, it } from 'vitest';
import { glassCss, glassDarkTheme, glassLightTheme, glassThemeToRn } from '../src/glass/index.js';

describe('glass emitters', () => {
  it('emits CSS variables, keyframes, and reduced motion last', () => {
    const css = glassCss(glassDarkTheme, glassLightTheme);

    expect(css).toMatchSnapshot();
    expect(css.lastIndexOf('@media (prefers-reduced-motion: reduce)')).toBeGreaterThan(
      css.lastIndexOf('@keyframes'),
    );
  });

  it('emits RN objects', () => {
    expect({
      dark: glassThemeToRn(glassDarkTheme),
      light: glassThemeToRn(glassLightTheme),
    }).toMatchSnapshot();
  });
});
