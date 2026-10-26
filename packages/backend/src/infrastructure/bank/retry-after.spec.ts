import { describe, it, expect } from 'vitest';
import { parseRetryAfter } from './retry-after.js';

const NOW = new Date('2026-10-26T12:00:00Z');

describe('parseRetryAfter', () => {
  it('reads delta-seconds from now', () => {
    expect(parseRetryAfter('120', NOW)).toEqual(new Date('2026-10-26T12:02:00Z'));
    expect(parseRetryAfter(' 0 ', NOW)).toEqual(NOW);
  });

  it('reads an HTTP-date', () => {
    expect(parseRetryAfter('Mon, 26 Oct 2026 13:30:00 GMT', NOW)).toEqual(
      new Date('2026-10-26T13:30:00Z'),
    );
  });

  it('returns null when the header is absent or unreadable', () => {
    expect(parseRetryAfter(null, NOW)).toBeNull();
    expect(parseRetryAfter('soon', NOW)).toBeNull();
    expect(parseRetryAfter('', NOW)).toBeNull();
  });
});
