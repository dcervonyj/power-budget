import type { IntlShape } from 'react-intl';
import { parseLocalIsoDate } from '@power-budget/core';

/** An ISO date (YYYY-MM-DD) in the locale's medium date format; an unreadable value stays raw. */
export function formatPlanDate(intl: IntlShape, isoDate: string): string {
  try {
    return intl.formatDate(parseLocalIsoDate(isoDate), { dateStyle: 'medium' });
  } catch {
    return isoDate;
  }
}

/** "1 Oct 2026 – 31 Oct 2026". */
export function formatPlanPeriod(intl: IntlShape, start: string, end: string): string {
  return intl.formatMessage(
    { id: 'plan.list.period', defaultMessage: '{start} – {end}' },
    { start: formatPlanDate(intl, start), end: formatPlanDate(intl, end) },
  );
}
