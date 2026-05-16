import { describe, it, expect } from 'vitest';
import { customBackoffStrategy, RETRY_DELAYS_MS, MAX_ATTEMPTS } from './retry-config';

describe('customBackoffStrategy', () => {
  it('returns 30s for first attempt', () => {
    expect(customBackoffStrategy(0)).toBe(30_000);
  });

  it('returns 2m for second attempt', () => {
    expect(customBackoffStrategy(1)).toBe(120_000);
  });

  it('returns 10m for third attempt', () => {
    expect(customBackoffStrategy(2)).toBe(600_000);
  });

  it('returns 1h for fourth attempt', () => {
    expect(customBackoffStrategy(3)).toBe(3_600_000);
  });

  it('returns 6h for fifth and beyond (caps at last value)', () => {
    expect(customBackoffStrategy(4)).toBe(21_600_000);
    expect(customBackoffStrategy(10)).toBe(21_600_000);
  });

  it('has exactly 5 attempts configured', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('has exactly 5 delay values', () => {
    expect(RETRY_DELAYS_MS).toHaveLength(5);
  });

  it('delays are monotonically increasing', () => {
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) {
      expect(RETRY_DELAYS_MS[i]!).toBeGreaterThan(RETRY_DELAYS_MS[i - 1]!);
    }
  });
});
