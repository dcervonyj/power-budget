import { describe, it, expect } from 'vitest';
import { themesToCss } from '../src/css.js';
import { darkTheme, lightTheme } from '../src/tokens.js';

describe('themesToCss', () => {
  it('contains --pb- prefixed variables', () => {
    const css = themesToCss(darkTheme, lightTheme);
    expect(css).toContain('--pb-color-surface-base');
    expect(css).toContain('--pb-color-accent-default');
    expect(css).toContain('--pb-space-md');
    expect(css).toContain('--pb-radius-pill');
    expect(css).toContain('--pb-font-size-lg');
  });

  it('has :root block for dark theme', () => {
    const css = themesToCss(darkTheme, lightTheme);
    expect(css).toMatch(/:root,\s*\[data-theme="dark"\]\s*\{/);
  });

  it('has [data-theme="light"] override block', () => {
    const css = themesToCss(darkTheme, lightTheme);
    expect(css).toContain('[data-theme="light"]');
  });

  it('matches snapshot', () => {
    const css = themesToCss(darkTheme, lightTheme);
    expect(css).toMatchSnapshot();
  });
});
