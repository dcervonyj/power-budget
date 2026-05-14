import { describe, it, expect } from 'vitest';
import { DateRange } from '../src/domain/shared/date-range.js';
import { IsoDate } from '../src/domain/shared/ids.js';

const d = (s: string) => IsoDate.of(s);

describe('DateRange', () => {
  describe('of', () => {
    it('creates a DateRange when start <= end', () => {
      const range = DateRange.of(d('2024-01-01'), d('2024-01-31'));
      expect(range.start).toBe('2024-01-01');
      expect(range.end).toBe('2024-01-31');
    });

    it('creates a DateRange when start === end', () => {
      const range = DateRange.of(d('2024-06-15'), d('2024-06-15'));
      expect(range.start).toBe(range.end);
    });

    it('throws when start > end', () => {
      expect(() => DateRange.of(d('2024-02-01'), d('2024-01-01'))).toThrow(
        'DateRange.start must be <= end',
      );
    });
  });

  describe('contains', () => {
    const range = DateRange.of(d('2024-03-01'), d('2024-03-31'));

    it('returns true for a date inside the range', () => {
      expect(DateRange.contains(range, d('2024-03-15'))).toBe(true);
    });

    it('returns true for the start date (inclusive)', () => {
      expect(DateRange.contains(range, d('2024-03-01'))).toBe(true);
    });

    it('returns true for the end date (inclusive)', () => {
      expect(DateRange.contains(range, d('2024-03-31'))).toBe(true);
    });

    it('returns false for a date before the range', () => {
      expect(DateRange.contains(range, d('2024-02-28'))).toBe(false);
    });

    it('returns false for a date after the range', () => {
      expect(DateRange.contains(range, d('2024-04-01'))).toBe(false);
    });
  });

  describe('overlaps', () => {
    it('returns true for overlapping ranges', () => {
      const a = DateRange.of(d('2024-01-01'), d('2024-01-15'));
      const b = DateRange.of(d('2024-01-10'), d('2024-01-31'));
      expect(DateRange.overlaps(a, b)).toBe(true);
    });

    it('returns true for touching ranges (same boundary)', () => {
      const a = DateRange.of(d('2024-01-01'), d('2024-01-15'));
      const b = DateRange.of(d('2024-01-15'), d('2024-01-31'));
      expect(DateRange.overlaps(a, b)).toBe(true);
    });

    it('returns false for non-overlapping ranges', () => {
      const a = DateRange.of(d('2024-01-01'), d('2024-01-14'));
      const b = DateRange.of(d('2024-01-15'), d('2024-01-31'));
      expect(DateRange.overlaps(a, b)).toBe(false);
    });

    it('returns true when one range contains the other', () => {
      const outer = DateRange.of(d('2024-01-01'), d('2024-12-31'));
      const inner = DateRange.of(d('2024-06-01'), d('2024-06-30'));
      expect(DateRange.overlaps(outer, inner)).toBe(true);
    });
  });

  describe('lengthInDays', () => {
    it('returns 1 for a single day', () => {
      const range = DateRange.of(d('2024-05-10'), d('2024-05-10'));
      expect(DateRange.lengthInDays(range)).toBe(1);
    });

    it('returns 7 for a week', () => {
      const range = DateRange.of(d('2024-05-01'), d('2024-05-07'));
      expect(DateRange.lengthInDays(range)).toBe(7);
    });

    it('returns 31 for January', () => {
      const range = DateRange.of(d('2024-01-01'), d('2024-01-31'));
      expect(DateRange.lengthInDays(range)).toBe(31);
    });
  });
});
