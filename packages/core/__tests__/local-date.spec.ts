import { describe, it, expect } from 'vitest';
import { parseLocalIsoDate, toLocalIsoDate } from '../src/logic/local-date.js';

describe('toLocalIsoDate', () => {
  it('uses the local calendar date, not the UTC one', () => {
    // toISOString() gives the UTC date: 22 Oct west of UTC late in the evening, 20 Oct east of UTC early in the morning.
    const lateEvening = new Date(2026, 9, 21, 23, 30);
    const earlyMorning = new Date(2026, 9, 21, 0, 15);

    expect(toLocalIsoDate(lateEvening)).toBe('2026-10-21');
    expect(toLocalIsoDate(earlyMorning)).toBe('2026-10-21');
  });

  it('pads month and day', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseLocalIsoDate', () => {
  it('gives local midnight of the same calendar day', () => {
    const date = parseLocalIsoDate('2026-10-01');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(0);
  });

  it('accepts a timestamp and keeps its date part', () => {
    expect(parseLocalIsoDate('2026-10-01T23:59:00.000Z').getDate()).toBe(1);
  });

  it('round-trips with toLocalIsoDate', () => {
    expect(toLocalIsoDate(parseLocalIsoDate('2024-02-29'))).toBe('2024-02-29');
  });

  it('rejects a malformed date', () => {
    expect(() => parseLocalIsoDate('21/10/2026')).toThrow();
  });
});
