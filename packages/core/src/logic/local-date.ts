import { IsoDate } from '../domain/shared/ids.js';

/**
 * The calendar date of `date` in the runtime's local time zone as 'YYYY-MM-DD'.
 * `toISOString().slice(0, 10)` gives the UTC date, which is a day off near midnight.
 */
export function toLocalIsoDate(date: Date): IsoDate {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return IsoDate.of(`${year}-${month}-${day}`);
}

/**
 * A 'YYYY-MM-DD' calendar date as a local-midnight Date, for display with
 * Intl/react-intl. `new Date('2026-10-21')` is UTC midnight, which shows the
 * previous day in time zones west of UTC.
 */
export function parseLocalIsoDate(iso: string): Date {
  const date = IsoDate.of(iso.slice(0, 10));

  return new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}
