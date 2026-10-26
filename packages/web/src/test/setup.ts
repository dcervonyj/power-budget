import '@testing-library/jest-dom';
import { vi } from 'vitest';

/** Media queries the tests assume by default: a dark OS with reduced motion on (count-ups show final values). */
const DEFAULT_MATCHES: Readonly<Record<string, boolean>> = {
  '(prefers-color-scheme: dark)': true,
  '(prefers-reduced-motion: reduce)': true,
};

function createMatchMedia(query: string): MediaQueryList {
  return {
    matches: DEFAULT_MATCHES[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  };
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: createMatchMedia,
});
