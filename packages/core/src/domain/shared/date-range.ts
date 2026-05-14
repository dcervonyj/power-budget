import type { IsoDate } from './ids.js';

export type { IsoDate } from './ids.js';

export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export const DateRange = {
  of(start: IsoDate, end: IsoDate): DateRange {
    if (start > end) {
      throw new Error('DateRange.start must be <= end');
    }
    return { start, end };
  },

  contains(range: DateRange, date: IsoDate): boolean {
    return range.start <= date && date <= range.end;
  },

  overlaps(a: DateRange, b: DateRange): boolean {
    return a.start <= b.end && b.start <= a.end;
  },

  lengthInDays(range: DateRange): number {
    const ms = Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`);
    return Math.round(ms / 86_400_000) + 1;
  },
};
