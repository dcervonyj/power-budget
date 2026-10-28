import { describe, it, expect } from 'vitest';
import { SystemClock } from './SystemClock.js';
import { UuidV7Generator } from './UuidV7Generator.js';

describe('SystemClock', () => {
  it('returns the current instant', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('UuidV7Generator', () => {
  it('returns distinct, version-7 uuids', () => {
    const generator = new UuidV7Generator();
    const first = generator.next();
    const second = generator.next();

    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
