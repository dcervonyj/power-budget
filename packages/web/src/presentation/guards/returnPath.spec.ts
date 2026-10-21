import { describe, it, expect } from 'vitest';
import { returnPath } from './returnPath.js';

describe('returnPath', () => {
  it('returns to the path and query RequireAuth came from', () => {
    expect(returnPath({ from: { pathname: '/invite/accept', search: '?token=abc' } })).toBe(
      '/invite/accept?token=abc',
    );
    expect(returnPath({ from: { pathname: '/household' } })).toBe('/household');
  });

  it.each([
    [undefined],
    [null],
    [{}],
    [{ from: 'x' }],
    [{ from: { pathname: 'https://evil.example' } }],
    [{ from: { pathname: '//evil.example' } }],
  ])('falls back to the dashboard for %j', (state) => {
    expect(returnPath(state)).toBe('/dashboard');
  });
});
