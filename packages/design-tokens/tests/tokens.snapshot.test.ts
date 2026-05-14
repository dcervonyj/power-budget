import { describe, it, expect } from 'vitest';
import { darkTheme, lightTheme } from '../src/tokens.js';

describe('tokens snapshot', () => {
  it('darkTheme matches snapshot', () => {
    expect(darkTheme).toMatchSnapshot();
  });

  it('lightTheme matches snapshot', () => {
    expect(lightTheme).toMatchSnapshot();
  });

  it('both themes have the same structural keys', () => {
    const darkKeys = JSON.stringify(Object.keys(darkTheme.color).sort());
    const lightKeys = JSON.stringify(Object.keys(lightTheme.color).sort());
    expect(darkKeys).toBe(lightKeys);
  });
});
