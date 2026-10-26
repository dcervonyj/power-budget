import type { IntlShape } from 'react-intl';

/** An ISO date as "31 October" in the UI locale (UTC, so the calendar day never shifts). */
export function formatDayMonth(isoDate: string, intl: IntlShape): string {
  return intl.formatDate(toUtcDate(isoDate), { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** An ISO date as "Thursday, 22 October" in the UI locale. */
export function formatWeekdayDate(isoDate: string, intl: IntlShape): string {
  return intl.formatDate(toUtcDate(isoDate), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}
